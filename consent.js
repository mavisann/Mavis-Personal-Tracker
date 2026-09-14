(function () {
  "use strict";
  var key = "mavis_consent";
  if (localStorage.getItem(key)) return;
  var banner = document.createElement("div");
  banner.className = "consent-banner";
  banner.innerHTML = '<p>We use localStorage for your session and preferences. <a href="privacy.html">Read our privacy policy</a>.</p><button class="btn btn-primary" type="button">Got it</button>';
  banner.querySelector("button").addEventListener("click", function () {
    localStorage.setItem(key, "accepted");
    banner.remove();
  });
  document.body.appendChild(banner);
}());
