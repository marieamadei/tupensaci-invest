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

const scenarios = {
  core: {
    revenues: ['€259k', '€479k', '€595k'], heights: ['44%', '81%', '100%'],
    ebitda: ['−€97k', '−€48k', '+€3k'], need: '€317k', label: 'Downside',
    note: 'CAC fisico a €16 e churn AI al 10% limitano il risultato nonostante il lancio: il round non copre integralmente il proof plan e i gate impongono correzione o stop.'
  },
  test: {
    revenues: ['€456k', '€817k', '€1,00 mln'], heights: ['46%', '82%', '100%'],
    ebitda: ['−€10k', '+€110k', '+€197k'], need: '€232k', label: 'Base',
    note: '≈2.079 utenti AI attivi a M12 e ≈4.000 a M24, mantenendo churn 8% e LTV/CAC 2,02x. Il round è unico; l’accelerazione del budget dipende dai gate.'
  },
  scale: {
    revenues: ['€689k', '€1,34 mln', '€1,72 mln'], heights: ['40%', '78%', '100%'],
    ebitda: ['+€96k', '+€361k', '+€548k'], need: '€183k', label: 'Upside',
    note: 'CAC fisico vicino al 2023 e retention AI più forte portano oltre 8.000 utenti AI attivi a M24. È un esito possibile, non la base usata per chiedere capitale.'
  }
};

document.querySelectorAll('[data-scenario]').forEach((button) => {
  button.addEventListener('click', () => {
    const key = button.dataset.scenario;
    const data = scenarios[key];
    if (!data) return;
    document.querySelectorAll('[data-scenario]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    document.querySelector('[data-scenario-label]').textContent = data.label;
    document.querySelector('[data-scenario-note]').textContent = data.note;
    document.querySelector('[data-scenario-need]').textContent = data.need;
    document.querySelectorAll('[data-revenue]').forEach((item, index) => {
      item.textContent = data.revenues[index];
      item.closest('.year').querySelector('i').style.setProperty('--height', data.heights[index]);
    });
    document.querySelectorAll('[data-ebitda]').forEach((item, index) => item.textContent = data.ebitda[index]);
  });
});
