const menu = document.querySelector('.menu-button');
const links = document.querySelector('.nav-links');
const progress = document.querySelector('.reading-progress');

menu?.addEventListener('click', () => {
  const open = links?.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(Boolean(open)));
});

links?.addEventListener('click', () => {
  links.classList.remove('open');
  menu?.setAttribute('aria-expanded', 'false');
});

const updateProgress = () => {
  if (!progress) return;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.width = `${max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0}%`;
};
window.addEventListener('scroll', updateProgress, { passive: true });
updateProgress();

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });
document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
