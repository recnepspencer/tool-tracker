(() => {
  const body = document.body;
  const header = document.querySelector("[data-header]");
  const menuToggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".nav-links");
  const progressBar = document.querySelector(".scroll-progress span");
  const currentPath = document.querySelector(".current-line");
  const currentShadow = document.querySelector(".current-shadow");
  const currentNode = document.querySelector(".current-node");
  const cursor = document.querySelector(".cursor");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  menuToggle?.addEventListener("click", () => {
    const isOpen = menuToggle.classList.toggle("active");
    nav.classList.toggle("open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    body.style.overflow = isOpen ? "hidden" : "";
  });

  nav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menuToggle?.classList.remove("active");
      nav.classList.remove("open");
      menuToggle?.setAttribute("aria-expanded", "false");
      body.style.overflow = "";
    });
  });

  let pathLength = 0;
  if (currentPath && currentShadow && currentNode) {
    pathLength = currentPath.getTotalLength();
    [currentPath, currentShadow].forEach((path) => {
      path.style.strokeDasharray = `${pathLength}`;
      path.style.strokeDashoffset = `${pathLength}`;
    });
  }

  const updateScrollEffects = () => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const progress = maxScroll > 0 ? Math.min(window.scrollY / maxScroll, 1) : 0;
    progressBar.style.transform = `scaleX(${progress})`;
    header?.classList.toggle("scrolled", window.scrollY > 40);

    if (pathLength && window.innerWidth > 760) {
      const offset = pathLength * (1 - progress);
      currentPath.style.strokeDashoffset = `${offset}`;
      currentShadow.style.strokeDashoffset = `${offset}`;
      const point = currentPath.getPointAtLength(pathLength * progress);
      currentNode.setAttribute("cx", point.x);
      currentNode.setAttribute("cy", point.y);
    }
  };

  updateScrollEffects();
  window.addEventListener("scroll", updateScrollEffects, { passive: true });
  window.addEventListener("resize", updateScrollEffects);

  if (!prefersReducedMotion && window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);

    gsap.timeline({ defaults: { ease: "power4.out" } })
      .from(".site-header", { y: -90, opacity: 0, duration: 1 })
      .from(".hero-image", { scale: 1.18, duration: 2.2 }, 0)
      .from(".title-line > span", { yPercent: 115, duration: 1.25, stagger: .12 }, .35)
      .to(".hero .reveal", { y: 0, opacity: 1, duration: .9, stagger: .08 }, .72)
      .to(".hero-stamp", { y: 0, opacity: 1, duration: 1 }, 1);

    gsap.utils.toArray(".reveal:not(.hero .reveal):not(.hero-stamp)").forEach((element) => {
      gsap.to(element, {
        y: 0,
        opacity: 1,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: { trigger: element, start: "top 88%", once: true }
      });
    });

    gsap.to(".hero-image", {
      yPercent: 12,
      ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
    });

    gsap.to(".hero-title", {
      y: 95,
      opacity: .25,
      ease: "none",
      scrollTrigger: { trigger: ".hero", start: "25% top", end: "bottom top", scrub: true }
    });

    gsap.from(".map-route", {
      strokeDashoffset: 500,
      duration: 2.3,
      ease: "power2.out",
      scrollTrigger: { trigger: ".map-wrap", start: "top 72%", once: true }
    });

    gsap.to(".cta-schematic", {
      rotate: 30,
      ease: "none",
      scrollTrigger: { trigger: ".final-cta", start: "top bottom", end: "bottom top", scrub: true }
    });

    document.querySelectorAll("[data-count]").forEach((counter) => {
      const endValue = Number(counter.dataset.count);
      const value = { current: 0 };
      gsap.to(value, {
        current: endValue,
        duration: 1.6,
        ease: "power2.out",
        scrollTrigger: { trigger: counter, start: "top 90%", once: true },
        onUpdate: () => { counter.textContent = Math.round(value.current); }
      });
    });
  } else {
    document.querySelectorAll(".reveal").forEach((el) => {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
    document.querySelectorAll("[data-count]").forEach((counter) => {
      counter.textContent = counter.dataset.count;
    });
  }

  if (cursor && window.matchMedia("(pointer:fine)").matches) {
    let cursorX = -100;
    let cursorY = -100;
    let targetX = -100;
    let targetY = -100;

    window.addEventListener("mousemove", (event) => {
      targetX = event.clientX;
      targetY = event.clientY;
    });

    const renderCursor = () => {
      cursorX += (targetX - cursorX) * .18;
      cursorY += (targetY - cursorY) * .18;
      cursor.style.left = `${cursorX}px`;
      cursor.style.top = `${cursorY}px`;
      requestAnimationFrame(renderCursor);
    };
    renderCursor();

    document.querySelectorAll("a, button, .project-card, .service-card").forEach((target) => {
      target.addEventListener("mouseenter", () => cursor.classList.add("active"));
      target.addEventListener("mouseleave", () => cursor.classList.remove("active"));
    });
  }

  if (!prefersReducedMotion && window.matchMedia("(pointer:fine)").matches) {
    document.querySelectorAll(".magnetic").forEach((element) => {
      element.addEventListener("mousemove", (event) => {
        const rect = element.getBoundingClientRect();
        const x = event.clientX - rect.left - rect.width / 2;
        const y = event.clientY - rect.top - rect.height / 2;
        element.style.transform = `translate(${x * .12}px, ${y * .16}px)`;
      });
      element.addEventListener("mouseleave", () => { element.style.transform = ""; });
    });

    document.querySelectorAll(".tilt").forEach((card) => {
      card.addEventListener("mousemove", (event) => {
        const rect = card.getBoundingClientRect();
        const rotateY = ((event.clientX - rect.left) / rect.width - .5) * 3;
        const rotateX = ((event.clientY - rect.top) / rect.height - .5) * -3;
        card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      });
      card.addEventListener("mouseleave", () => { card.style.transform = ""; });
    });
  }
})();
