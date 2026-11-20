document.addEventListener("DOMContentLoaded", function () {
  var loginScreen = document.getElementById("loginScreen");
  var dashScreen = document.getElementById("dashScreen");
  var loginError = document.getElementById("loginError");
  var emailInput = document.getElementById("adminEmail");
  var passInput = document.getElementById("adminPassword");
  var modal = document.getElementById("modal");
  var modalTitle = document.getElementById("modalTitle");
  var modalBody = document.getElementById("modalBody");
  var modalMode = null;
  var modalId = null;

  function showDash() {
    loginScreen.classList.add("hidden");
    dashScreen.classList.remove("hidden");
    renderAll();
  }
  function showLogin() {
    dashScreen.classList.add("hidden");
    loginScreen.classList.remove("hidden");
  }

  Store.isAdminSession()
    .then(function (ok) {
      if (ok) showDash();
    })
    .catch(function () {
      showLogin();
    });

  document.getElementById("btnLogin").addEventListener("click", async function () {
    loginError.textContent = "กำลังเข้าสู่ระบบ...";
    try {
      await Store.loginEmail(emailInput.value, passInput.value);
      loginError.textContent = "";
      showDash();
    } catch (err) {
      loginError.textContent = err.message || "เข้าสู่ระบบไม่สำเร็จ";
    }
  });

  passInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") document.getElementById("btnLogin").click();
  });

  document.getElementById("btnLogout").addEventListener("click", async function () {
    await Store.logout();
    showLogin();
  });

  document.querySelectorAll(".tab-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".tab-btn").forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      var tab = btn.getAttribute("data-tab");
      document.getElementById("tab-orders").classList.toggle("hidden", tab !== "orders");
      document.getElementById("tab-logs").classList.toggle("hidden", tab !== "logs");
      document.getElementById("tab-abuse").classList.toggle("hidden", tab !== "abuse");
    });
  });

  document.getElementById("filterOrderStatus").addEventListener("change", renderOrders);
  document.getElementById("logSearch").addEventListener("input", renderLogs);

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function fmt(ts) {
    if (!ts) return "—";
    return new Date(ts).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
  }
  function labelStatus(s) {
    return (
      {
        pending: "รอชำระ",
        paid: "ชำระแล้ว",
        active: "เปิดใช้แล้ว",
        suspended: "ระงับ",
        cancelled: "ยกเลิก",
        open: "เปิด",
        investigating: "กำลังตรวจ",
        resolved: "ปิดแล้ว",
        escalated: "ส่งต่อเจ้าหน้าที่"
      }[s] || s
    );
  }

  async function renderAll() {
    await renderOrders();
    await renderLogs();
    await renderAbuse();
  }

  async function renderOrders() {
    try {
      var stats = await Store.orderStats();
      document.getElementById("orderStats").innerHTML =
        stat("ทั้งหมด", stats.total) +
        stat("รอชำระ", stats.pending) +
        stat("ชำระแล้ว", stats.paid) +
        stat("เปิดใช้", stats.active) +
        stat("ระงับ", stats.suspended);

      var filter = document.getElementById("filterOrderStatus").value;
      var list = (await Store.listOrders()).filter(function (o) {
        return filter === "all" || o.status === filter;
      });
      var body = document.getElementById("orderBody");
      if (!list.length) {
        body.innerHTML = '<tr><td colspan="6" class="empty">ไม่มีออเดอร์</td></tr>';
        return;
      }
      body.innerHTML = list
        .map(function (o) {
          return (
            "<tr><td><code>" +
            esc(o.id) +
            "</code></td><td>" +
            esc(o.name) +
            "<br><small>" +
            esc(o.contact) +
            "</small></td><td>" +
            esc(o.plan) +
            '</td><td><span class="badge-status badge-' +
            esc(o.status) +
            '">' +
            labelStatus(o.status) +
            "</span></td><td>" +
            fmt(o.createdAt) +
            '</td><td><button type="button" class="btn-link" data-open-order="' +
            esc(o.id) +
            '">จัดการ</button></td></tr>'
          );
        })
        .join("");
      body.querySelectorAll("[data-open-order]").forEach(function (b) {
        b.addEventListener("click", function () {
          openOrder(b.getAttribute("data-open-order"));
        });
      });
    } catch (err) {
      document.getElementById("orderBody").innerHTML =
        '<tr><td colspan="6" class="empty">' + esc(err.message) + "</td></tr>";
    }
  }

  function stat(label, n) {
    return (
      '<div class="stat-card"><small>' + label + "</small><strong>" + n + "</strong></div>"
    );
  }

  async function openOrder(id) {
    var o = await Store.getOrder(id);
    if (!o) return;
    modalMode = "order";
    modalId = id;
    modalTitle.textContent = o.id;
    modalBody.innerHTML =
      input("name", "ชื่อ", o.name) +
      input("contact", "ติดต่อ", o.contact) +
      input("phone", "เบอร์", o.phone || "") +
      input("plan", "แพ็ก", o.plan) +
      select(
        "status",
        "สถานะ",
        ["pending", "paid", "active", "suspended", "cancelled"],
        o.status
      ) +
      input("vpnUser", "VPN Username", o.vpnUser || "") +
      input("vpnPass", "VPN Password / Key", o.vpnPass || "") +
      input("serverLabel", "เซิร์ฟเวอร์", o.serverLabel || "") +
      area("note", "หมายเหตุ", o.note || "");
    modal.classList.remove("hidden");
  }

  async function renderLogs() {
    try {
      var list = await Store.searchLogs(document.getElementById("logSearch").value);
      var body = document.getElementById("logBody");
      if (!list.length) {
        body.innerHTML = '<tr><td colspan="7" class="empty">ยังไม่มี log</td></tr>';
        return;
      }
      body.innerHTML = list
        .map(function (r) {
          return (
            "<tr><td><code>" +
            esc(r.id) +
            "</code></td><td>" +
            esc(r.accountId) +
            "</td><td>" +
            esc(r.clientIp) +
            "</td><td>" +
            esc(r.serverIp) +
            (r.serverPort ? ":" + esc(r.serverPort) : "") +
            "</td><td>" +
            fmt(r.startedAt) +
            "</td><td>" +
            fmt(r.endedAt) +
            '</td><td><button type="button" class="btn-link" data-open-log="' +
            esc(r.id) +
            '">แก้</button></td></tr>'
          );
        })
        .join("");
      body.querySelectorAll("[data-open-log]").forEach(function (b) {
        b.addEventListener("click", function () {
          openLog(b.getAttribute("data-open-log"));
        });
      });
    } catch (err) {
      document.getElementById("logBody").innerHTML =
        '<tr><td colspan="7" class="empty">' + esc(err.message) + "</td></tr>";
    }
  }

  document.getElementById("btnAddLog").addEventListener("click", function () {
    modalMode = "log-new";
    modalId = null;
    modalTitle.textContent = "เพิ่ม Connection Log";
    modalBody.innerHTML =
      input("accountId", "Account", "") +
      input("clientIp", "Client IP", "") +
      input("serverIp", "Server IP", "") +
      input("serverPort", "Port", "51820") +
      input("protocol", "Protocol", "wireguard") +
      area("note", "หมายเหตุ", "");
    modal.classList.remove("hidden");
  });

  async function openLog(id) {
    var list = await Store.listLogs();
    var r = list.find(function (x) {
      return x.id === id;
    });
    if (!r) return;
    modalMode = "log";
    modalId = id;
    modalTitle.textContent = r.id;
    modalBody.innerHTML =
      input("accountId", "Account", r.accountId) +
      input("clientIp", "Client IP", r.clientIp) +
      input("serverIp", "Server IP", r.serverIp) +
      input("serverPort", "Port", r.serverPort || "") +
      input("protocol", "Protocol", r.protocol || "") +
      area("note", "หมายเหตุ", r.note || "");
    modal.classList.remove("hidden");
  }

  async function renderAbuse() {
    try {
      var list = await Store.listAbuse();
      var body = document.getElementById("abuseBody");
      if (!list.length) {
        body.innerHTML = '<tr><td colspan="6" class="empty">ยังไม่มีรายการ</td></tr>';
        return;
      }
      body.innerHTML = list
        .map(function (r) {
          return (
            "<tr><td><code>" +
            esc(r.id) +
            "</code></td><td>" +
            esc(r.source) +
            "</td><td>" +
            esc(r.relatedAccount) +
            '</td><td><span class="badge-status badge-' +
            esc(r.status) +
            '">' +
            labelStatus(r.status) +
            "</span></td><td>" +
            fmt(r.createdAt) +
            '</td><td><button type="button" class="btn-link" data-open-abuse="' +
            esc(r.id) +
            '">จัดการ</button></td></tr>'
          );
        })
        .join("");
      body.querySelectorAll("[data-open-abuse]").forEach(function (b) {
        b.addEventListener("click", function () {
          openAbuse(b.getAttribute("data-open-abuse"));
        });
      });
    } catch (err) {
      document.getElementById("abuseBody").innerHTML =
        '<tr><td colspan="6" class="empty">' + esc(err.message) + "</td></tr>";
    }
  }

  document.getElementById("btnAddAbuse").addEventListener("click", function () {
    modalMode = "abuse-new";
    modalId = null;
    modalTitle.textContent = "บันทึก Abuse";
    modalBody.innerHTML =
      input("source", "แหล่ง", "") +
      input("relatedAccount", "บัญชี", "") +
      input("relatedOrderId", "ออเดอร์", "") +
      input("timeRange", "ช่วงเวลา", "") +
      area("summary", "สรุป", "");
    modal.classList.remove("hidden");
  });

  async function openAbuse(id) {
    var list = await Store.listAbuse();
    var r = list.find(function (x) {
      return x.id === id;
    });
    if (!r) return;
    modalMode = "abuse";
    modalId = id;
    modalTitle.textContent = r.id;
    modalBody.innerHTML =
      input("source", "แหล่ง", r.source) +
      input("relatedAccount", "บัญชี", r.relatedAccount) +
      input("relatedOrderId", "ออเดอร์", r.relatedOrderId || "") +
      input("timeRange", "ช่วงเวลา", r.timeRange || "") +
      select(
        "status",
        "สถานะ",
        ["open", "investigating", "resolved", "escalated"],
        r.status
      ) +
      area("summary", "สรุป", r.summary || "") +
      area("actionTaken", "การดำเนินการ", r.actionTaken || "");
    modal.classList.remove("hidden");
  }

  function input(id, label, value) {
    return (
      "<label>" +
      label +
      '<input id="f_' +
      id +
      '" value="' +
      esc(value) +
      '"></label>'
    );
  }
  function area(id, label, value) {
    return (
      "<label>" +
      label +
      '<textarea id="f_' +
      id +
      '" rows="3">' +
      esc(value) +
      "</textarea></label>"
    );
  }
  function select(id, label, options, current) {
    var opts = options
      .map(function (o) {
        return (
          '<option value="' +
          o +
          '"' +
          (o === current ? " selected" : "") +
          ">" +
          labelStatus(o) +
          "</option>"
        );
      })
      .join("");
    return "<label>" + label + '<select id="f_' + id + '">' + opts + "</select></label>";
  }
  function val(id) {
    var el = document.getElementById("f_" + id);
    return el ? el.value : "";
  }

  document.getElementById("modalClose").addEventListener("click", function () {
    modal.classList.add("hidden");
  });
  modal.addEventListener("click", function (e) {
    if (e.target === modal) modal.classList.add("hidden");
  });

  document.getElementById("btnModalSave").addEventListener("click", async function () {
    try {
      if (modalMode === "order" && modalId) {
        await Store.updateOrder(modalId, {
          name: val("name"),
          contact: val("contact"),
          phone: val("phone"),
          plan: val("plan"),
          status: val("status"),
          vpnUser: val("vpnUser"),
          vpnPass: val("vpnPass"),
          serverLabel: val("serverLabel"),
          note: val("note")
        });
      } else if (modalMode === "log-new") {
        await Store.addLog({
          accountId: val("accountId"),
          clientIp: val("clientIp"),
          serverIp: val("serverIp"),
          serverPort: val("serverPort"),
          protocol: val("protocol"),
          note: val("note")
        });
      } else if (modalMode === "log" && modalId) {
        await Store.updateLog(modalId, {
          accountId: val("accountId"),
          clientIp: val("clientIp"),
          serverIp: val("serverIp"),
          serverPort: val("serverPort"),
          protocol: val("protocol"),
          note: val("note")
        });
      } else if (modalMode === "abuse-new") {
        await Store.addAbuse({
          source: val("source"),
          relatedAccount: val("relatedAccount"),
          relatedOrderId: val("relatedOrderId"),
          timeRange: val("timeRange"),
          summary: val("summary")
        });
      } else if (modalMode === "abuse" && modalId) {
        await Store.updateAbuse(modalId, {
          source: val("source"),
          relatedAccount: val("relatedAccount"),
          relatedOrderId: val("relatedOrderId"),
          timeRange: val("timeRange"),
          status: val("status"),
          summary: val("summary"),
          actionTaken: val("actionTaken")
        });
      }
      modal.classList.add("hidden");
      await renderAll();
    } catch (err) {
      alert(err.message || "บันทึกไม่สำเร็จ");
    }
  });

  document.getElementById("btnModalDelete").addEventListener("click", async function () {
    if (!modalId) {
      modal.classList.add("hidden");
      return;
    }
    if (!confirm("ลบรายการนี้?")) return;
    try {
      if (modalMode === "order") await Store.removeOrder(modalId);
      if (modalMode === "log") await Store.removeLog(modalId);
      if (modalMode === "abuse") await Store.removeAbuse(modalId);
      modal.classList.add("hidden");
      await renderAll();
    } catch (err) {
      alert(err.message || "ลบไม่สำเร็จ");
    }
  });

  document.getElementById("btnExport").addEventListener("click", async function () {
    try {
      var text = await Store.exportAll();
      var blob = new Blob([text], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "securevpn-backup.json";
      a.click();
    } catch (err) {
      alert(err.message || "Export ไม่สำเร็จ");
    }
  });
});
