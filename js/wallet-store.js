/**
 * SecureVPN Wallet extension — ต่อท้าย js/store.js
 * เมธอด: getWallet, ensureWallet, createTopup, listMyTopups,
 *        listAllTopups, approveTopup, rejectTopup,
 *        buyPlan, listMyPurchases, listAllPurchases, updatePurchase
 */
(function (global) {
  if (!global.Store) {
    console.error("ต้องโหลด store.js ก่อน wallet-store.js");
    return;
  }

  var Store = global.Store;

  function uid(prefix) {
    return (
      prefix +
      "-" +
      Date.now().toString(36).toUpperCase() +
      "-" +
      Math.floor(Math.random() * 900 + 100)
    );
  }

  function now() {
    return Date.now();
  }

  /** แพ็กเกจเริ่มต้น (แก้ราคาได้ที่นี่หรือย้ายไป config) */
  Store.PLANS = [
    { code: "day", label: "รายวัน", price: 19, desc: "1 อุปกรณ์ · เซิร์ฟเวอร์พื้นฐาน" },
    { code: "month", label: "รายเดือน", price: 149, desc: "สูงสุด 3 อุปกรณ์ · หลายโลเคชัน" },
    { code: "quarter", label: "ราย 3 เดือน", price: 399, desc: "สูงสุด 5 อุปกรณ์ · แพ็กประหยัด" }
  ];

  Store.ensureWallet = async function () {
    var s = await this.requireCustomerSession();
    var sb = this.getClient();
    var res = await sb.from("wallets").select("*").eq("user_id", s.user.id).maybeSingle();
    if (res.error) throw new Error(res.error.message);
    if (res.data) {
      return { userId: res.data.user_id, balance: Number(res.data.balance || 0) };
    }
    var ins = await sb.from("wallets").insert({ user_id: s.user.id, balance: 0 });
    if (ins.error) throw new Error(ins.error.message);
    return { userId: s.user.id, balance: 0 };
  };

  Store.getWallet = async function () {
    return this.ensureWallet();
  };

  Store.createTopup = async function (data) {
    var s = await this.requireCustomerSession();
    var amount = Number(data.amount || 0);
    if (!(amount > 0)) throw new Error("ระบุจำนวนเงินให้ถูกต้อง");
    var method = (data.method || "bank").trim();
    var row = {
      id: uid("TOP"),
      user_id: s.user.id,
      amount: amount,
      method: method,
      ref_code: (data.refCode || "").trim(),
      note: (data.note || "").trim(),
      status: "pending",
      admin_note: "",
      created_at: now(),
      updated_at: now()
    };
    var sb = this.getClient();
    var res = await sb.from("topups").insert(row);
    if (res.error) throw new Error(res.error.message);
    return row;
  };

  Store.listMyTopups = async function () {
    var s = await this.requireCustomerSession();
    var sb = this.getClient();
    var res = await sb
      .from("topups")
      .select("*")
      .eq("user_id", s.user.id)
      .order("created_at", { ascending: false });
    if (res.error) throw new Error(res.error.message);
    return res.data || [];
  };

  Store.listAllTopups = async function () {
    var sb = this.getClient();
    var res = await sb.from("topups").select("*").order("created_at", { ascending: false });
    if (res.error) throw new Error(res.error.message);
    return res.data || [];
  };

  /**
   * แอดมินอนุมัติเติมเงิน → เพิ่ม balance
   * ทำแบบอ่าน balance แล้วอัปเดต (พอใช้ขั้น 1; production ควรใช้ RPC/transaction)
   */
  Store.approveTopup = async function (topupId, adminNote) {
    var sb = this.getClient();
    var tRes = await sb.from("topups").select("*").eq("id", topupId).maybeSingle();
    if (tRes.error) throw new Error(tRes.error.message);
    var t = tRes.data;
    if (!t) throw new Error("ไม่พบคำขอเติมเงิน");
    if (t.status !== "pending") throw new Error("คำขอนี้ถูกจัดการแล้ว");

    var wRes = await sb.from("wallets").select("*").eq("user_id", t.user_id).maybeSingle();
    if (wRes.error) throw new Error(wRes.error.message);
    var bal = wRes.data ? Number(wRes.data.balance || 0) : 0;
    var next = bal + Number(t.amount);

    if (!wRes.data) {
      var ins = await sb.from("wallets").insert({ user_id: t.user_id, balance: next });
      if (ins.error) throw new Error(ins.error.message);
    } else {
      var upW = await sb
        .from("wallets")
        .update({ balance: next, updated_at: new Date().toISOString() })
        .eq("user_id", t.user_id);
      if (upW.error) throw new Error(upW.error.message);
    }

    var upT = await sb
      .from("topups")
      .update({
        status: "approved",
        admin_note: adminNote || "",
        updated_at: now()
      })
      .eq("id", topupId);
    if (upT.error) throw new Error(upT.error.message);
    return { balance: next };
  };

  Store.rejectTopup = async function (topupId, adminNote) {
    var sb = this.getClient();
    var up = await sb
      .from("topups")
      .update({
        status: "rejected",
        admin_note: adminNote || "",
        updated_at: now()
      })
      .eq("id", topupId)
      .eq("status", "pending");
    if (up.error) throw new Error(up.error.message);
  };

  Store.buyPlan = async function (planCode) {
    var s = await this.requireCustomerSession();
    var plan = (this.PLANS || []).find(function (p) {
      return p.code === planCode;
    });
    if (!plan) throw new Error("ไม่พบแพ็กเกจ");

    var wallet = await this.ensureWallet();
    if (wallet.balance < plan.price) {
      throw new Error("เครดิตไม่พอ (มี " + wallet.balance + " บาท ต้องการ " + plan.price + " บาท)");
    }

    var nextBal = Number((wallet.balance - plan.price).toFixed(2));
    var sb = this.getClient();

    var upW = await sb
      .from("wallets")
      .update({ balance: nextBal, updated_at: new Date().toISOString() })
      .eq("user_id", s.user.id);
    if (upW.error) throw new Error(upW.error.message);

    var row = {
      id: uid("BUY"),
      user_id: s.user.id,
      plan_code: plan.code,
      plan_label: plan.label + " – ฿" + plan.price,
      price: plan.price,
      status: "paid",
      vpn_user: "",
      vpn_pass: "",
      server_label: "",
      note: "",
      created_at: now(),
      updated_at: now()
    };
    var ins = await sb.from("purchases").insert(row);
    if (ins.error) {
      // พยายามคืนเครดิตถ้า insert ไม่สำเร็จ
      await sb.from("wallets").update({ balance: wallet.balance }).eq("user_id", s.user.id);
      throw new Error(ins.error.message);
    }
    return { purchase: row, balance: nextBal };
  };

  Store.listMyPurchases = async function () {
    var s = await this.requireCustomerSession();
    var sb = this.getClient();
    var res = await sb
      .from("purchases")
      .select("*")
      .eq("user_id", s.user.id)
      .order("created_at", { ascending: false });
    if (res.error) throw new Error(res.error.message);
    return res.data || [];
  };

  Store.listAllPurchases = async function () {
    var sb = this.getClient();
    var res = await sb.from("purchases").select("*").order("created_at", { ascending: false });
    if (res.error) throw new Error(res.error.message);
    return res.data || [];
  };

  Store.updatePurchase = async function (id, patch) {
    var mapped = { updated_at: now() };
    if (patch.status !== undefined) mapped.status = patch.status;
    if (patch.vpnUser !== undefined) mapped.vpn_user = patch.vpnUser;
    if (patch.vpnPass !== undefined) mapped.vpn_pass = patch.vpnPass;
    if (patch.serverLabel !== undefined) mapped.server_label = patch.serverLabel;
    if (patch.note !== undefined) mapped.note = patch.note;
    var sb = this.getClient();
    var up = await sb.from("purchases").update(mapped).eq("id", id);
    if (up.error) throw new Error(up.error.message);
  };
})(window);
