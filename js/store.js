/**
 * SecureVPN Store → Supabase (+ Auth สำหรับแอดมิน)
 */
(function (global) {
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

  function getClient() {
    if (!global.supabase || typeof global.supabase.createClient !== "function") {
      throw new Error("ยังไม่ได้โหลด @supabase/supabase-js");
    }
    var url = global.SUPABASE_URL || "";
    var key = global.SUPABASE_ANON_KEY || "";
    if (!url || !key || key.indexOf("PASTE_") === 0) {
      throw new Error("กรุณาใส่ SUPABASE_URL และ SUPABASE_ANON_KEY ใน js/config.js");
    }
    if (!global.__svpnSb) {
      global.__svpnSb = global.supabase.createClient(url, key);
    }
    return global.__svpnSb;
  }

  function mapOrderRow(r) {
    if (!r) return null;
    return {
      id: r.id,
      name: r.name || "",
      contact: r.contact || "",
      phone: r.phone || "",
      plan: r.plan || "",
      note: r.note || "",
      paymentRef: r.payment_ref || "",
      tosAccepted: !!r.tos_accepted,
      status: r.status || "pending",
      vpnUser: r.vpn_user || "",
      vpnPass: r.vpn_pass || "",
      serverLabel: r.server_label || "",
      createdAt: r.created_at || 0,
      updatedAt: r.updated_at || 0
    };
  }

  function orderToRow(o) {
    return {
      id: o.id,
      name: o.name || "",
      contact: o.contact || "",
      phone: o.phone || "",
      plan: o.plan || "",
      note: o.note || "",
      payment_ref: o.paymentRef || "",
      tos_accepted: !!o.tosAccepted,
      status: o.status || "pending",
      vpn_user: o.vpnUser || "",
      vpn_pass: o.vpnPass || "",
      server_label: o.serverLabel || "",
      created_at: o.createdAt || now(),
      updated_at: o.updatedAt || now()
    };
  }

  function mapLogRow(r) {
    if (!r) return null;
    return {
      id: r.id,
      accountId: r.account_id || "",
      clientIp: r.client_ip || "",
      serverIp: r.server_ip || "",
      serverPort: r.server_port || "",
      protocol: r.protocol || "wireguard",
      startedAt: r.started_at || 0,
      endedAt: r.ended_at || null,
      bytesIn: r.bytes_in || 0,
      bytesOut: r.bytes_out || 0,
      note: r.note || "",
      createdAt: r.created_at || 0
    };
  }

  function mapAbuseRow(r) {
    if (!r) return null;
    return {
      id: r.id,
      source: r.source || "",
      relatedAccount: r.related_account || "",
      relatedOrderId: r.related_order_id || "",
      timeRange: r.time_range || "",
      summary: r.summary || "",
      status: r.status || "open",
      actionTaken: r.action_taken || "",
      createdAt: r.created_at || 0,
      updatedAt: r.updated_at || 0
    };
  }

  async function must(queryResult, action) {
    if (queryResult.error) {
      console.error(action, queryResult.error);
      throw new Error(queryResult.error.message || action + " ล้มเหลว");
    }
    return queryResult.data;
  }

  var Store = {
    getClient: getClient,

    /* ===== Auth ===== */
    getSession: async function () {
      var sb = getClient();
      var res = await sb.auth.getSession();
      if (res.error) throw new Error(res.error.message);
      return res.data.session || null;
    },

    loginEmail: async function (email, password) {
      var sb = getClient();
      var res = await sb.auth.signInWithPassword({
        email: String(email || "").trim(),
        password: String(password || "")
      });
      if (res.error) throw new Error(res.error.message);
      // ตรวจว่าเป็นแอดมินในตาราง admin_users
      var uid = res.data.user && res.data.user.id;
      if (!uid) throw new Error("ล็อกอินไม่สำเร็จ");
      var check = await sb.from("admin_users").select("user_id").eq("user_id", uid).maybeSingle();
      if (check.error) throw new Error(check.error.message);
      if (!check.data) {
        await sb.auth.signOut();
        throw new Error("บัญชีนี้ไม่ใช่แอดมิน");
      }
      return res.data.session;
    },

    logout: async function () {
      var sb = getClient();
      await sb.auth.signOut();
    },

    isAdminSession: async function () {
      var session = await this.getSession();
      if (!session || !session.user) return false;
      var sb = getClient();
      var check = await sb
        .from("admin_users")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      return !!(check.data && check.data.user_id);
    },

    /* ===== Orders ===== */
    listOrders: async function () {
      var sb = getClient();
      var data = await must(
        await sb.from("orders").select("*").order("created_at", { ascending: false }),
        "listOrders"
      );
      return (data || []).map(mapOrderRow);
    },

    getOrder: async function (id) {
      var sb = getClient();
      var data = await must(
        await sb.from("orders").select("*").eq("id", id).maybeSingle(),
        "getOrder"
      );
      return mapOrderRow(data);
    },

    addOrder: async function (data) {
      var order = {
        id: uid("ORD"),
        name: (data.name || "").trim(),
        contact: (data.contact || "").trim(),
        phone: (data.phone || "").trim(),
        plan: (data.plan || "").trim(),
        note: (data.note || "").trim(),
        paymentRef: (data.paymentRef || "").trim(),
        tosAccepted: !!data.tosAccepted,
        status: "pending",
        vpnUser: "",
        vpnPass: "",
        serverLabel: "",
        createdAt: now(),
        updatedAt: now()
      };
      var sb = getClient();
      await must(await sb.from("orders").insert(orderToRow(order)), "addOrder");
      return order;
    },

    updateOrder: async function (id, patch) {
      var current = await this.getOrder(id);
      if (!current) return null;
      var next = Object.assign({}, current, patch, { updatedAt: now() });
      var sb = getClient();
      await must(
        await sb.from("orders").update(orderToRow(next)).eq("id", id),
        "updateOrder"
      );
      return next;
    },

    removeOrder: async function (id) {
      var sb = getClient();
      await must(await sb.from("orders").delete().eq("id", id), "removeOrder");
    },

    orderStats: async function () {
      var list = await this.listOrders();
      function c(s) {
        return list.filter(function (o) {
          return o.status === s;
        }).length;
      }
      return {
        total: list.length,
        pending: c("pending"),
        paid: c("paid"),
        active: c("active"),
        suspended: c("suspended"),
        cancelled: c("cancelled")
      };
    },

    /* ===== Logs ===== */
    listLogs: async function () {
      var sb = getClient();
      var data = await must(
        await sb.from("conn_logs").select("*").order("started_at", { ascending: false }),
        "listLogs"
      );
      return (data || []).map(mapLogRow);
    },

    addLog: async function (data) {
      var row = {
        id: uid("LOG"),
        account_id: (data.accountId || "").trim(),
        client_ip: (data.clientIp || "").trim(),
        server_ip: (data.serverIp || "").trim(),
        server_port: (data.serverPort || "").trim(),
        protocol: (data.protocol || "wireguard").trim(),
        started_at: data.startedAt ? Number(data.startedAt) : now(),
        ended_at: data.endedAt ? Number(data.endedAt) : null,
        bytes_in: Number(data.bytesIn || 0),
        bytes_out: Number(data.bytesOut || 0),
        note: (data.note || "").trim(),
        created_at: now()
      };
      var sb = getClient();
      await must(await sb.from("conn_logs").insert(row), "addLog");
      return mapLogRow(row);
    },

    updateLog: async function (id, patch) {
      var sb = getClient();
      var mapped = {};
      if (patch.accountId !== undefined) mapped.account_id = patch.accountId;
      if (patch.clientIp !== undefined) mapped.client_ip = patch.clientIp;
      if (patch.serverIp !== undefined) mapped.server_ip = patch.serverIp;
      if (patch.serverPort !== undefined) mapped.server_port = patch.serverPort;
      if (patch.protocol !== undefined) mapped.protocol = patch.protocol;
      if (patch.startedAt !== undefined) mapped.started_at = patch.startedAt;
      if (patch.endedAt !== undefined) mapped.ended_at = patch.endedAt;
      if (patch.note !== undefined) mapped.note = patch.note;
      await must(await sb.from("conn_logs").update(mapped).eq("id", id), "updateLog");
      var data = await must(
        await sb.from("conn_logs").select("*").eq("id", id).maybeSingle(),
        "updateLog-read"
      );
      return mapLogRow(data);
    },

    removeLog: async function (id) {
      var sb = getClient();
      await must(await sb.from("conn_logs").delete().eq("id", id), "removeLog");
    },

    searchLogs: async function (q) {
      q = (q || "").trim();
      if (!q) return this.listLogs();
      var all = await this.listLogs();
      var lower = q.toLowerCase();
      return all.filter(function (r) {
        return (
          (r.accountId || "").toLowerCase().indexOf(lower) >= 0 ||
          (r.clientIp || "").indexOf(q) >= 0 ||
          (r.serverIp || "").indexOf(q) >= 0 ||
          (r.id || "").toLowerCase().indexOf(lower) >= 0
        );
      });
    },

    /* ===== Abuse ===== */
    listAbuse: async function () {
      var sb = getClient();
      var data = await must(
        await sb
          .from("abuse_reports")
          .select("*")
          .order("created_at", { ascending: false }),
        "listAbuse"
      );
      return (data || []).map(mapAbuseRow);
    },

    addAbuse: async function (data) {
      var row = {
        id: uid("ABU"),
        source: (data.source || "").trim(),
        related_account: (data.relatedAccount || "").trim(),
        related_order_id: (data.relatedOrderId || "").trim(),
        time_range: (data.timeRange || "").trim(),
        summary: (data.summary || "").trim(),
        status: "open",
        action_taken: "",
        created_at: now(),
        updated_at: now()
      };
      var sb = getClient();
      await must(await sb.from("abuse_reports").insert(row), "addAbuse");
      return mapAbuseRow(row);
    },

    updateAbuse: async function (id, patch) {
      var mapped = { updated_at: now() };
      if (patch.source !== undefined) mapped.source = patch.source;
      if (patch.relatedAccount !== undefined) mapped.related_account = patch.relatedAccount;
      if (patch.relatedOrderId !== undefined) mapped.related_order_id = patch.relatedOrderId;
      if (patch.timeRange !== undefined) mapped.time_range = patch.timeRange;
      if (patch.summary !== undefined) mapped.summary = patch.summary;
      if (patch.status !== undefined) mapped.status = patch.status;
      if (patch.actionTaken !== undefined) mapped.action_taken = patch.actionTaken;
      var sb = getClient();
      await must(await sb.from("abuse_reports").update(mapped).eq("id", id), "updateAbuse");
      var data = await must(
        await sb.from("abuse_reports").select("*").eq("id", id).maybeSingle(),
        "updateAbuse-read"
      );
      return mapAbuseRow(data);
    },

    removeAbuse: async function (id) {
      var sb = getClient();
      await must(await sb.from("abuse_reports").delete().eq("id", id), "removeAbuse");
    },

    exportAll: async function () {
      return JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          orders: await this.listOrders(),
          logs: await this.listLogs(),
          abuse: await this.listAbuse()
        },
        null,
        2
      );
    },

    importAll: async function (text) {
      var data = JSON.parse(text);
      var sb = getClient();
      if (Array.isArray(data.orders) && data.orders.length) {
        var orderRows = data.orders.map(function (o) {
          return orderToRow({
            id: o.id,
            name: o.name,
            contact: o.contact,
            phone: o.phone,
            plan: o.plan,
            note: o.note,
            paymentRef: o.paymentRef || o.payment_ref,
            tosAccepted: o.tosAccepted || o.tos_accepted,
            status: o.status,
            vpnUser: o.vpnUser || o.vpn_user,
            vpnPass: o.vpnPass || o.vpn_pass,
            serverLabel: o.serverLabel || o.server_label,
            createdAt: o.createdAt || o.created_at,
            updatedAt: o.updatedAt || o.updated_at
          });
        });
        await must(await sb.from("orders").upsert(orderRows), "import-orders");
      }
    }
  };

  global.Store = Store;
})(window);
/**
 * เพิ่มเมธอดลูกค้าใน Store
 * วิธีใช้: รวมเข้า js/store.js หรือวางต่อท้าย store.js ที่มีอยู่
 *
 * เมธอดใหม่:
 * - listMyOrders()
 * - addOrder() แนบ user_id อัตโนมัติถ้าล็อกอิน
 * - requireCustomerSession()
 */
(function (global) {
  if (!global.Store) {
    console.error("ต้องโหลด store.js ก่อน");
    return;
  }

  var Store = global.Store;

  Store.requireCustomerSession = async function () {
    var s = await this.getSession();
    if (!s || !s.user) {
      throw new Error("กรุณาเข้าสู่ระบบก่อน");
    }
    return s;
  };

  Store.listMyOrders = async function () {
    var s = await this.requireCustomerSession();
    var sb = this.getClient();
    var res = await sb
      .from("orders")
      .select("*")
      .eq("user_id", s.user.id)
      .order("created_at", { ascending: false });
    if (res.error) throw new Error(res.error.message);
    return (res.data || []).map(function (r) {
      return {
        id: r.id,
        name: r.name || "",
        contact: r.contact || "",
        phone: r.phone || "",
        plan: r.plan || "",
        note: r.note || "",
        status: r.status || "pending",
        vpnUser: r.vpn_user || "",
        vpnPass: r.vpn_pass || "",
        serverLabel: r.server_label || "",
        createdAt: r.created_at || 0,
        updatedAt: r.updated_at || 0
      };
    });
  };

  // เก็บ addOrder เดิม แล้วห่อใหม่ให้ใส่ user_id
  var _addOrder = Store.addOrder.bind(Store);
  Store.addOrder = async function (data) {
    var session = null;
    try {
      session = await this.getSession();
    } catch (e) {}

    if (!session || !session.user) {
      throw new Error("กรุณาเข้าสู่ระบบก่อนสั่งซื้อ");
    }

    var order = await _addOrder(data);
    // อัปเดต user_id หลัง insert (หรือแก้ insert ให้รวม user_id)
    var sb = this.getClient();
    var up = await sb
      .from("orders")
      .update({ user_id: session.user.id })
      .eq("id", order.id);
    if (up.error) {
      console.warn("ผูก user_id ไม่สำเร็จ", up.error);
    }
    return order;
  };
})(window);
