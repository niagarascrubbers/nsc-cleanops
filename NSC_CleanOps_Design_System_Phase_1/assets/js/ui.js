const NSC_UI = (() => {
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];

  function initSidebar() {
    const sidebar = $("#nscSidebar");
    const overlay = $("#nscSidebarOverlay");
    const openButton = $("[data-sidebar-open]");
    const closeSidebar = () => {
      sidebar?.classList.remove("is-open");
      overlay?.classList.remove("is-visible");
      document.body.style.overflow = "";
    };
    const openSidebar = () => {
      sidebar?.classList.add("is-open");
      overlay?.classList.add("is-visible");
      document.body.style.overflow = "hidden";
    };

    openButton?.addEventListener("click", openSidebar);
    overlay?.addEventListener("click", closeSidebar);
    $$(".nsc-nav-link", sidebar || document).forEach(link => {
      link.addEventListener("click", closeSidebar);
    });
  }

  function openPanel(panelId) {
    const panel = document.getElementById(panelId);
    const overlay = $("#nscPanelOverlay");
    if (!panel) return;
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    overlay?.classList.add("is-visible");
    document.body.style.overflow = "hidden";
  }

  function closePanels() {
    $$(".nsc-panel.is-open").forEach(panel => {
      panel.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");
    });
    $("#nscPanelOverlay")?.classList.remove("is-visible");
    document.body.style.overflow = "";
  }

  function initPanels() {
    $$("[data-panel-open]").forEach(button => {
      button.addEventListener("click", () => openPanel(button.dataset.panelOpen));
    });
    $$("[data-panel-close]").forEach(button => {
      button.addEventListener("click", closePanels);
    });
    $("#nscPanelOverlay")?.addEventListener("click", closePanels);
  }

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal?.classList.add("is-visible");
  }

  function closeModals() {
    $$(".nsc-modal-overlay.is-visible").forEach(modal => {
      modal.classList.remove("is-visible");
    });
  }

  function initModals() {
    $$("[data-modal-open]").forEach(button => {
      button.addEventListener("click", () => openModal(button.dataset.modalOpen));
    });
    $$("[data-modal-close]").forEach(button => {
      button.addEventListener("click", closeModals);
    });
    $$(".nsc-modal-overlay").forEach(overlay => {
      overlay.addEventListener("click", event => {
        if (event.target === overlay) closeModals();
      });
    });
  }

  function toast(title, message = "", type = "success") {
    let container = $("#nscToastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "nscToastContainer";
      container.className = "nsc-toast-container";
      document.body.appendChild(container);
    }

    const item = document.createElement("div");
    item.className = "nsc-toast";
    if (type === "danger") item.style.borderLeftColor = "var(--nsc-danger)";
    if (type === "warning") item.style.borderLeftColor = "var(--nsc-warning)";

    const copy = document.createElement("div");
    const heading = document.createElement("strong");
    heading.textContent = title;
    copy.appendChild(heading);

    if (message) {
      const paragraph = document.createElement("p");
      paragraph.textContent = message;
      copy.appendChild(paragraph);
    }

    item.appendChild(copy);
    container.appendChild(item);

    window.setTimeout(() => {
      item.style.opacity = "0";
      item.style.transform = "translateY(-6px)";
      window.setTimeout(() => item.remove(), 180);
    }, 3200);
  }

  function setActiveNavigation() {
    const filename = location.pathname.split("/").pop() || "manager-dashboard.html";
    $$(".nsc-nav-link").forEach(link => {
      const href = link.getAttribute("href");
      link.classList.toggle("is-active", href === filename);
    });
  }

  function init() {
    initSidebar();
    initPanels();
    initModals();
    setActiveNavigation();

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closePanels();
        closeModals();
      }
    });
  }

  return { init, toast, openPanel, closePanels, openModal, closeModals };
})();

document.addEventListener("DOMContentLoaded", NSC_UI.init);
