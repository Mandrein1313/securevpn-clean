document.addEventListener("DOMContentLoaded", function () {
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  var menuBtn = document.getElementById("menuBtn");
  var navLinks = document.getElementById("navLinks");
  if (menuBtn && navLinks) {
    menuBtn.addEventListener("click", function () {
      navLinks.classList.toggle("open");
    });
    navLinks.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        navLinks.classList.remove("open");
      });
    });
  }

  var planSelect = document.getElementById("planSelect");
  document.querySelectorAll("[data-plan]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var plan = btn.getAttribute("data-plan");
      if (planSelect && plan) planSelect.value = plan;
      var order = document.getElementById("order");
      if (order) order.scrollIntoView({ behavior: "smooth" });
    });
  });

  var form = document.getElementById("orderForm");
  var result = document.getElementById("formResult");
  if (!form) return;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var data = new FormData(form);
    var tos = document.getElementById("tosCheck");
    if (!tos || !tos.checked) {
      if (result) result.textContent = "กรุณายอมรับข้อตกลงก่อนส่งออเดอร์";
      return;
    }

    var payload = {
      name: String(data.get("name") || "").trim(),
      contact: String(data.get("contact") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      plan: String(data.get("plan") || "").trim(),
      note: String(data.get("note") || "").trim(),
      tosAccepted: true
    };

    if (!payload.name || !payload.contact) {
      if (result) result.textContent = "กรุณากรอกชื่อและช่องทางติดต่อ";
      return;
    }

    var order = Store.addOrder(payload);

    var message =
      "[SecureVPN ออเดอร์ใหม่]\n" +
      "รหัส: " + order.id + "\n" +
      "ชื่อ: " + payload.name + "\n" +
      "ติดต่อ: " + payload.contact + "\n" +
      (payload.phone ? "เบอร์: " + payload.phone + "\n" : "") +
      "แพ็ก: " + payload.plan + "\n" +
      (payload.note ? "หมายเหตุ: " + payload.note + "\n" : "") +
      "TOS: ยอมรับแล้ว\n";

    function done() {
      if (result) {
        result.textContent = "บันทึกออเดอร์ " + order.id + " แล้ว — คัดลอกข้อความไปแจ้งร้านได้";
      }
      form.reset();
      if (tos) tos.checked = false;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(message).then(done, function () {
        window.prompt("คัดลอกข้อความนี้:", message);
        done();
      });
    } else {
      window.prompt("คัดลอกข้อความนี้:", message);
      done();
    }
  });
});
