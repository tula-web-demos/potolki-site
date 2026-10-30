'use strict';

/**
 * НАСТРОЙКИ ПЕРЕД ПУБЛИКАЦИЕЙ.
 * Укажите реальные контакты и адрес приёма заявок.
 * Тарифы ниже — демонстрационные, не являются действующим прайсом.
 */
const SITE_CONFIG = {
  phoneDigits: '',              // Например: '74872123456', без знака «+»
  phoneDisplay: '',             // Например: '+7 (4872) 12-34-56'
  email: '',                    // Рабочая почта компании
  telegramUrl: '',              // Например: 'https://t.me/название_аккаунта'
  whatsappUrl: '',              // Например: 'https://wa.me/79XXXXXXXXX'
  formEndpoint: '',             // Адрес обработчика заявок, принимающего запросы POST с данными в JSON
  estimate: {
    coveringPerSquareMeter: {
      matte: 690,
      satin: 780,
      gloss: 830,
      fabric: 1690,
      floating: 1320,
      double: 2250,
      light: 1540,
      stars: 2700,
      shadow: 1160
    },
    profilePerMeter: 190,
    spotlight: 650,
    chandelier: 800,
    extraLightLineBase: 2800,
    extraLightLinePerMeter: 350,
    lowerMultiplier: 0.90,
    upperMultiplier: 1.18
  }
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const numberFormatter = new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 0});
let toastTimer;

function toast(message) {
  const element = $('#toast');
  if (!element) return;
  element.textContent = message;
  element.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element.hidden = true; }, 5100);
}

function closeDialog(dialog) {
  if (dialog && dialog.open) dialog.close();
  document.body.classList.toggle('dialog-open', Boolean($$('dialog').find(item => item.open)));
}
function openDialog(dialog) {
  if (!dialog || dialog.open) return;
  dialog.showModal();
  document.body.classList.add('dialog-open');
}

// Настраиваем ссылки так, чтобы заглушки не инициировали звонки на несуществующие номера.
$$('[data-phone-link]').forEach(link => {
  if (SITE_CONFIG.phoneDigits && /^7\d{10}$/.test(SITE_CONFIG.phoneDigits)) {
    link.href = `tel:+${SITE_CONFIG.phoneDigits}`;
    if (SITE_CONFIG.phoneDisplay) link.textContent = SITE_CONFIG.phoneDisplay;
  } else {
    link.addEventListener('click', event => {
      event.preventDefault();
      toast('Укажите действующий номер телефона в настройках сайта перед публикацией.');
    });
  }
});
$$('[data-email-link]').forEach(link => {
  if (SITE_CONFIG.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(SITE_CONFIG.email)) {
    link.href = `mailto:${SITE_CONFIG.email}`;
    link.textContent = SITE_CONFIG.email;
  } else {
    link.addEventListener('click', event => {
      event.preventDefault();
      toast('Добавьте рабочий адрес электронной почты в настройках сайта.');
    });
  }
});
$$('[data-messenger]').forEach(link => {
  const kind = link.dataset.messenger;
  const url = kind === 'telegram' ? SITE_CONFIG.telegramUrl : SITE_CONFIG.whatsappUrl;
  if (url && /^https:\/\//i.test(url)) {
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  } else {
    link.addEventListener('click', event => {
      event.preventDefault();
      toast('Ссылка на мессенджер появится после добавления контакта компании.');
    });
  }
});

// Шапка и мобильное меню.
const header = $('.site-header');
function updateHeader() { header?.classList.toggle('is-scrolled', window.scrollY > 22); }
window.addEventListener('scroll', updateHeader, {passive: true});
updateHeader();
const menuButton = $('.menu-toggle');
const mobileNav = $('#mobile-nav');
function setMenu(open) {
  if (!menuButton || !mobileNav) return;
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  mobileNav.hidden = !open;
}
menuButton?.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
$$('a,button', mobileNav).forEach(link => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') setMenu(false);
});

// Ненавязчивое появление карточек при прокрутке.
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, {rootMargin: '0px 0px -35px 0px', threshold: 0.07});
  $$('.reveal').forEach(item => observer.observe(item));
} else {
  $$('.reveal').forEach(item => item.classList.add('in-view'));
}

// Калькулятор стоимости.
const CEILING_NAMES = {
  matte: 'Матовый', satin: 'Сатиновый', gloss: 'Глянцевый',
  fabric: 'Тканевый', floating: 'Парящий', double: 'Двухуровневый',
  light: 'Со световыми линиями', stars: '«Звёздное небо»', shadow: 'Теневой профиль'
};
const areaInput = $('#room-area');
const areaRange = $('#room-area-range');
const typeInput = $('#ceiling-type');
const spotsInput = $('#spotlights');
const chandeliersInput = $('#chandeliers');
const lineInput = $('#light-line');
let currentEstimate = null;

function clamp(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}
function plural(number, one, few, many) {
  const n = Math.abs(number) % 100;
  const last = n % 10;
  return n > 10 && n < 20 ? many : last > 1 && last < 5 ? few : last === 1 ? one : many;
}
function calculate() {
  if (!areaInput) return;
  const area = clamp(areaInput.value, 1, 300, 18);
  const type = typeInput.value;
  const spotlights = Math.round(clamp(spotsInput.value, 0, 60, 0));
  const chandeliers = Math.round(clamp(chandeliersInput.value, 0, 10, 0));
  const hasLightLine = lineInput.checked;
  const approximatePerimeter = 4 * Math.sqrt(area);
  const tariffs = SITE_CONFIG.estimate;
  const covering = area * tariffs.coveringPerSquareMeter[type];
  const profile = approximatePerimeter * tariffs.profilePerMeter;
  const lighting = spotlights * tariffs.spotlight + chandeliers * tariffs.chandelier;
  const lightLine = hasLightLine ? tariffs.extraLightLineBase + Math.sqrt(area) * tariffs.extraLightLinePerMeter : 0;
  const subtotal = covering + profile + lighting + lightLine;
  const lower = Math.round(subtotal * tariffs.lowerMultiplier / 100) * 100;
  const upper = Math.round(subtotal * tariffs.upperMultiplier / 100) * 100;
  const areaDisplay = Number.isInteger(area) ? String(area) : String(area).replace('.', ',');
  const lightingParts = [];
  if (spotlights) lightingParts.push(`${spotlights} ${plural(spotlights, 'светильник', 'светильника', 'светильников')}`);
  if (chandeliers) lightingParts.push(`${chandeliers} ${plural(chandeliers, 'люстра', 'люстры', 'люстр')}`);
  if (hasLightLine) lightingParts.push('световая линия');
  const lightingText = lightingParts.join(', ') || 'Без светильников';
  $('#calc-total').textContent = `${numberFormatter.format(lower)}–${numberFormatter.format(upper)} ₽`;
  $('#summary-area').textContent = `${areaDisplay} м²`;
  $('#summary-type').textContent = CEILING_NAMES[type];
  $('#summary-light').textContent = lightingText;
  const progress = Math.max(0, Math.min(100, ((area - 1) / 99) * 100));
  areaRange.style.background = `linear-gradient(to right, #d8b17d ${progress}%, #49453f ${progress}%)`;
  currentEstimate = {area: areaDisplay, type: CEILING_NAMES[type], light: lightingText, lower, upper};
}
[areaInput, areaRange, typeInput, spotsInput, chandeliersInput, lineInput].filter(Boolean).forEach(element => {
  element.addEventListener('input', () => {
    if (element === areaRange) areaInput.value = areaRange.value;
    if (element === areaInput) areaRange.value = String(clamp(areaInput.value, 1, 100, 18));
    calculate();
  });
  element.addEventListener('change', () => {
    if (element === areaInput) areaInput.value = String(clamp(areaInput.value, 1, 300, 18));
    if (element === spotsInput) spotsInput.value = String(Math.round(clamp(spotsInput.value, 0, 60, 0)));
    if (element === chandeliersInput) chandeliersInput.value = String(Math.round(clamp(chandeliersInput.value, 0, 10, 0)));
    calculate();
  });
});
$$('[data-step]').forEach(button => button.addEventListener('click', () => {
  const element = document.getElementById(button.dataset.for);
  if (!element) return;
  element.value = String(Math.round(clamp(Number(element.value) + Number(button.dataset.step), Number(element.min), Number(element.max), 0)));
  element.dispatchEvent(new Event('input', {bubbles: true}));
}));
calculate();

// Фильтруем подборку и показываем изображения в доступном диалоговом окне.
const projects = $$('.project-card');
const filterButtons = $$('.filter-btn');
const lightbox = $('#lightbox-dialog');
const lightboxImage = $('#lightbox-image');
let visibleProjects = projects.slice();
let currentProjectIndex = 0;
filterButtons.forEach(button => button.addEventListener('click', () => {
  const filter = button.dataset.filter;
  filterButtons.forEach(other => {
    const active = other === button;
    other.classList.toggle('active', active);
    other.setAttribute('aria-pressed', String(active));
  });
  projects.forEach(project => { project.hidden = filter !== 'all' && project.dataset.category !== filter; });
  visibleProjects = projects.filter(project => !project.hidden);
}));
function showProject(index) {
  if (!visibleProjects.length) return;
  currentProjectIndex = (index + visibleProjects.length) % visibleProjects.length;
  const project = visibleProjects[currentProjectIndex];
  lightboxImage.src = project.dataset.image;
  lightboxImage.alt = $('img', project).alt;
  $('#lightbox-title').textContent = project.dataset.title;
  $('#lightbox-description').textContent = project.dataset.description;
}
projects.forEach(project => project.addEventListener('click', () => {
  visibleProjects = projects.filter(item => !item.hidden);
  showProject(visibleProjects.indexOf(project));
  openDialog(lightbox);
}));
$('[data-lightbox-prev]')?.addEventListener('click', () => showProject(currentProjectIndex - 1));
$('[data-lightbox-next]')?.addEventListener('click', () => showProject(currentProjectIndex + 1));
lightbox?.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') { event.preventDefault(); showProject(currentProjectIndex - 1); }
  if (event.key === 'ArrowRight') { event.preventDefault(); showProject(currentProjectIndex + 1); }
});

// Заказ звонка, конфиденциальность и навигация из окон.
$$('[data-open-modal]').forEach(button => button.addEventListener('click', () => openDialog($('#callback-dialog'))));
$$('[data-privacy]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  openDialog($('#privacy-dialog'));
}));
$$('[data-close-dialog]').forEach(button => button.addEventListener('click', () => closeDialog(button.closest('dialog'))));
$$('[data-close-on-navigate]').forEach(link => link.addEventListener('click', () => closeDialog(link.closest('dialog'))));
$$('dialog').forEach(dialog => {
  dialog.addEventListener('click', event => {
    if (event.target === dialog) closeDialog(dialog);
  });
  dialog.addEventListener('close', () => {
    document.body.classList.toggle('dialog-open', Boolean($$('dialog').find(item => item.open)));
  });
});

// Маска российского номера. Значение формы проверяется отдельно перед отправкой.
function formatRussianPhone(raw) {
  let digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits[0] === '8') digits = `7${digits.slice(1)}`;
  else if (digits[0] === '9') digits = `7${digits}`;
  else if (digits[0] !== '7') digits = `7${digits}`;
  digits = digits.slice(0, 11);
  const local = digits.slice(1);
  let result = '+7';
  if (local.length) result += ` (${local.slice(0, 3)}`;
  if (local.length >= 3) result += ')';
  if (local.length > 3) result += ` ${local.slice(3, 6)}`;
  if (local.length > 6) result += `-${local.slice(6, 8)}`;
  if (local.length > 8) result += `-${local.slice(8, 10)}`;
  return result;
}
$$('[data-phone-mask]').forEach(input => {
  input.addEventListener('input', () => {
    input.value = formatRussianPhone(input.value);
    input.setCustomValidity('');
  });
  input.addEventListener('blur', () => {
    if (input.value === '+7') input.value = '';
  });
});

function validateLead(form) {
  const name = $('[name="name"]', form);
  const phone = $('[name="phone"]', form);
  const consent = $('[name="consent"]', form);
  [name, phone, consent].forEach(input => input.setCustomValidity(''));
  if (name.value.trim().length < 2) {
    name.setCustomValidity('Введите ваше имя — не менее двух символов.');
    name.reportValidity(); name.focus(); return false;
  }
  const digits = phone.value.replace(/\D/g, '');
  if (!/^7\d{10}$/.test(digits)) {
    phone.setCustomValidity('Введите номер в формате +7 (999) 999-99-99.');
    phone.reportValidity(); phone.focus(); return false;
  }
  if (!consent.checked) {
    consent.setCustomValidity('Подтвердите согласие на обработку персональных данных.');
    consent.reportValidity(); consent.focus(); return false;
  }
  return true;
}
$$('[data-lead-form]').forEach(form => {
  form.addEventListener('input', event => {
    if (event.target.setCustomValidity) event.target.setCustomValidity('');
  });
  form.addEventListener('change', event => {
    if (event.target.setCustomValidity) event.target.setCustomValidity('');
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const feedback = $('.form-feedback', form);
    feedback.textContent = '';
    feedback.className = 'form-feedback';
    if (!validateLead(form)) return;
    const data = {
      source: form.dataset.source,
      name: $('[name="name"]', form).value.trim(),
      phone: $('[name="phone"]', form).value.trim(),
      callbackTime: $('[name="time"]', form)?.value || 'Не указано',
      consent: true,
      estimate: form.dataset.source === 'Калькулятор' ? currentEstimate : null,
      sentAt: new Date().toISOString()
    };
    if (!SITE_CONFIG.formEndpoint) {
      feedback.classList.add('is-info');
      feedback.textContent = 'Демонстрационный режим: заявка не отправлена. Для приёма заявок подключите обработчик формы в настройках сайта.';
      return;
    }
    const submitButton = $('button[type="submit"]', form);
    const originalLabel = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.textContent = 'Отправляем заявку…';
    try {
      const response = await fetch(SITE_CONFIG.formEndpoint, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Ошибка ответа');
      feedback.classList.add('is-success');
      feedback.textContent = 'Спасибо! Заявка отправлена. Мы свяжемся с вами, чтобы уточнить детали.';
      form.reset();
    } catch (_error) {
      feedback.classList.add('is-error');
      feedback.textContent = 'Не удалось отправить заявку. Попробуйте ещё раз или свяжитесь с нами по телефону.';
    } finally {
      submitButton.innerHTML = originalLabel;
      submitButton.disabled = false;
    }
  });
});

$('#year').textContent = String(new Date().getFullYear());
