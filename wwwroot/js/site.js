(() => {
    const shell = document.getElementById("layoutShell");
    const openButton = document.querySelector("[data-sidebar-open]");
    const closeButtons = document.querySelectorAll("[data-sidebar-close]");

    openButton?.addEventListener("click", () => shell?.classList.add("is-sidebar-open"));
    closeButtons.forEach((button) =>
        button.addEventListener("click", () => shell?.classList.remove("is-sidebar-open")));
})();
