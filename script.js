// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute("href"));
    if (target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  });
});

// No scroll-based effects for the glowing circle. All animation is handled by CSS.

// Intersection Observer for animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: "0px 0px -50px 0px",
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = "1";
      entry.target.style.transform = "translateY(0)";
    }
  });
}, observerOptions);

// Observe all sections for animation
document.querySelectorAll("section").forEach((section) => {
  section.style.opacity = "0";
  section.style.transform = "translateY(50px)";
  section.style.transition = "opacity 0.8s ease, transform 0.8s ease";
  observer.observe(section);
});

// Skill bars animation
const skillBars = document.querySelectorAll(".skill-progress");
skillBars.forEach((bar) => {
  const width = bar.style.width;
  bar.style.width = "0%";

  const skillObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            bar.style.width = width;
          }, 500);
        }
      });
    },
    { threshold: 0.5 }
  );

  skillObserver.observe(bar);
});

// Work items hover effect
document.querySelectorAll(".work-item").forEach((item) => {
  item.addEventListener("mouseenter", function () {
    this.style.transform = "translateY(-10px) scale(1.02)";
  });

  item.addEventListener("mouseleave", function () {
    this.style.transform = "translateY(0) scale(1)";
  });
});

// Button click effects
document.querySelectorAll(".btn-primary, .btn-secondary").forEach((button) => {
  button.addEventListener("click", function (e) {
    // Create ripple effect
    const ripple = document.createElement("span");
    const rect = this.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = size + "px";
    ripple.style.left = x + "px";
    ripple.style.top = y + "px";
    ripple.classList.add("ripple");

    this.appendChild(ripple);

    setTimeout(() => {
      ripple.remove();
    }, 600);
  });
});

// Add ripple effect styles
const style = document.createElement("style");
style.textContent = `
    .btn-primary, .btn-secondary {
        position: relative;
        overflow: hidden;
    }
    
    .ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: scale(0);
        animation: ripple-animation 0.6s linear;
        pointer-events: none;
    }
    
    @keyframes ripple-animation {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Navbar background on scroll
window.addEventListener("scroll", () => {
  const navbar = document.querySelector(".navbar");
  if (window.scrollY > 100) {
    navbar.style.background = "rgba(255, 255, 255, 0.15)";
    navbar.style.backdropFilter = "blur(30px)";
  } else {
    navbar.style.background = "rgba(255, 255, 255, 0.1)";
    navbar.style.backdropFilter = "blur(20px)";
  }
});

// Typing effect for hero title
function typeWriter(element, text, speed = 100) {
  let i = 0;
  element.innerHTML = "";

  function type() {
    if (i < text.length) {
      element.innerHTML += text.charAt(i);
      i++;
      setTimeout(type, speed);
    }
  }

  type();
}

// Initialize typing effect when page loads
window.addEventListener("load", () => {
  const heroName = document.querySelector(".hero-name");
  if (heroName) {
    const originalText = heroName.textContent;
    typeWriter(heroName, originalText, 150);
  }
});

// Smooth reveal animation for work items
const workItems = document.querySelectorAll(".work-item");
workItems.forEach((item, index) => {
  item.style.opacity = "0";
  item.style.transform = "translateY(30px)";
  item.style.transition = "opacity 0.6s ease, transform 0.6s ease";

  const workObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.style.opacity = "1";
            entry.target.style.transform = "translateY(0)";
          }, index * 200);
        }
      });
    },
    { threshold: 0.3 }
  );

  workObserver.observe(item);
});

// Add enhanced floating animation to glass ring
const glassRing = document.querySelector(".glass-ring");
if (glassRing) {
  glassRing.style.animation =
    "rotate 20s linear infinite, float 6s ease-in-out infinite";

  // Add 3D perspective effect
  glassRing.style.perspective = "1000px";
  glassRing.style.transformStyle = "preserve-3d";
}

// Add enhanced floating keyframes with 3D effects
const floatingStyle = document.createElement("style");
floatingStyle.textContent = `
    @keyframes float {
        0%, 100% { 
            transform: translate(-50%, -50%) translateY(0px) rotateX(0deg) rotateY(0deg) rotateZ(0deg); 
        }
        25% { 
            transform: translate(-50%, -50%) translateY(-15px) rotateX(10deg) rotateY(10deg) rotateZ(5deg); 
        }
        50% { 
            transform: translate(-50%, -50%) translateY(-25px) rotateX(0deg) rotateY(0deg) rotateZ(0deg); 
        }
        75% { 
            transform: translate(-50%, -50%) translateY(-15px) rotateX(-10deg) rotateY(-10deg) rotateZ(-5deg); 
        }
    }
    
    @keyframes spectrum-pulse {
        0%, 100% { 
            box-shadow: 
                0 0 100px rgba(255, 59, 48, 0.4),
                0 0 200px rgba(88, 86, 214, 0.3),
                0 0 300px rgba(52, 199, 89, 0.2),
                inset 0 0 50px rgba(255, 255, 255, 0.1);
        }
        50% { 
            box-shadow: 
                0 0 150px rgba(255, 59, 48, 0.6),
                0 0 250px rgba(88, 86, 214, 0.5),
                0 0 350px rgba(52, 199, 89, 0.4),
                inset 0 0 70px rgba(255, 255, 255, 0.2);
        }
    }
`;
document.head.appendChild(floatingStyle);

// Performance optimization: Throttle scroll events
function throttle(func, limit) {
  let inThrottle;
  return function () {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Apply throttling to scroll events
window.addEventListener(
  "scroll",
  throttle(() => {
    // Scroll-based animations are already handled above
  }, 16)
); // ~60fps

console.log("Portfolio website loaded successfully! 🚀");
