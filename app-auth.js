const REMEMBERED_EMAIL_KEY = 'crudeforce_remembered_email';

function saveRememberedEmail() {
  const email = document.getElementById('authEmail')?.value?.trim();
  const remember = document.getElementById('rememberEmail')?.checked;
  if (remember && email) {
    localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
  } else {
    localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  }
}

function loadRememberedEmail() {
  const email = localStorage.getItem(REMEMBERED_EMAIL_KEY);
  if (email) {
    const el = document.getElementById('authEmail');
    if (el) el.value = email;
    const cb = document.getElementById('rememberEmail');
    if (cb) cb.checked = true;
  }
}

async function loadProfile() {
  if (!me) return;
  const { data } = await sb.from('profiles').select('*').eq('user_id', me.id).single();
  profile = data;
  if (profile?.custom_role_id) {
    const { data: r } = await sb.from('custom_roles').select('name').eq('id', profile.custom_role_id).maybeSingle();
    profile.role_label = r?.name || profile.role;
  } else {
    profile.role_label = profile?.role;
  }
  const who = document.getElementById('who');
  if (who) {
    who.innerHTML = `${esc(profile?.display_name || me.email)}<br><span class="badge">${esc(profile?.role_label || 'user')}</span>`;
  }
}

async function sessionChanged(session) {
  if (!session) {
    me = null;
    profile = null;
    document.getElementById('auth')?.classList.remove('hidden');
    document.getElementById('app')?.classList.add('hidden');
    return;
  }
  me = session.user;
  document.getElementById('auth')?.classList.add('hidden');
  document.getElementById('app')?.classList.remove('hidden');
  await loadProfile();
  if (typeof loadRefs === 'function') await loadRefs();
  if (typeof renderNav === 'function') renderNav();
  if (typeof go === 'function') await go(current);
}

function setupAuth() {
  loadRememberedEmail();

  const form = document.getElementById('authForm');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      saveRememberedEmail();
      const email = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPassword').value;
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        if (typeof toast === 'function') toast(error.message);
        else alert(error.message);
      }
    };
  }

  const signupBtn = document.getElementById('signupBtn');
  if (signupBtn) {
    signupBtn.onclick = async () => {
      saveRememberedEmail();
      const email = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPassword').value;
      const { error } = await sb.auth.signUp({ email, password });
      if (error) {
        if (typeof toast === 'function') toast(error.message);
        else alert(error.message);
      } else {
        if (typeof toast === 'function') toast('Account created. Check email if confirmation is enabled.');
        else alert('Account created.');
      }
    };
  }

  const signoutBtn = document.getElementById('signout');
  if (signoutBtn) {
    signoutBtn.onclick = () => sb.auth.signOut();
  }

  sb.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => sessionChanged(session), 0);
  });

  sb.auth.getSession().then(({ data }) => sessionChanged(data.session));
}
