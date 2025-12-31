<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { authStore, isAuthenticated, isLoading } from '$lib/auth';
  import '../app.css';

  let menuOpen = false;

  onMount(() => {
    authStore.initialize();

    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
    }
  });

  $: publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password'];
  $: isPublicRoute = publicRoutes.some((route) => $page.url.pathname.startsWith(route));

  // Close menu when route changes
  $: $page.url.pathname, menuOpen = false;

  $: if ($authStore.initialized && !$isLoading) {
    if (!$isAuthenticated && !isPublicRoute) {
      goto('/login');
    } else if ($isAuthenticated && isPublicRoute) {
      goto('/');
    }
  }

  async function handleLogout() {
    await authStore.logout();
    goto('/login');
  }
</script>

<svelte:head>
  <title>Lifelogs</title>
</svelte:head>

{#if $isLoading}
  <div class="loading-screen">
    <div class="loading-spinner"></div>
  </div>
{:else if $isAuthenticated}
  <div class="app-layout">
    <header class="header">
      <div class="header-content">
        <a href="/" class="logo">Lifelogs</a>

        <button
          class="menu-toggle"
          on:click={() => (menuOpen = !menuOpen)}
          aria-label="Toggle menu"
        >
          <span class="menu-icon" class:open={menuOpen}></span>
        </button>

        <nav class="nav" class:open={menuOpen}>
          <a href="/" class="nav-link" class:active={$page.url.pathname === '/'} on:click={() => (menuOpen = false)}>
            Dashboard
          </a>
          <a href="/log" class="nav-link" class:active={$page.url.pathname === '/log'} on:click={() => (menuOpen = false)}>
            Log Event
          </a>
          <a href="/charts" class="nav-link" class:active={$page.url.pathname === '/charts'} on:click={() => (menuOpen = false)}>
            Charts
          </a>
          <a href="/import" class="nav-link" class:active={$page.url.pathname === '/import'} on:click={() => (menuOpen = false)}>
            Import
          </a>
          <button class="nav-link logout-btn" on:click={() => { menuOpen = false; handleLogout(); }}>
            Logout
          </button>
        </nav>
      </div>
    </header>

    <main class="main">
      <slot />
    </main>
  </div>
{:else}
  <slot />
{/if}

<style>
  .loading-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-gray-200);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .app-layout {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .header {
    background-color: white;
    border-bottom: 1px solid var(--color-gray-200);
    position: sticky;
    top: 0;
    z-index: 100;
    padding-top: env(safe-area-inset-top);
  }

  .header-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 60px;
  }

  .logo {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-primary);
    text-decoration: none;
  }

  .menu-toggle {
    display: none;
    background: none;
    border: none;
    padding: 0.75rem;
    cursor: pointer;
    border-radius: 0.375rem;
  }

  .menu-toggle:hover {
    background-color: var(--color-gray-100);
  }

  .menu-icon {
    display: block;
    width: 20px;
    height: 2px;
    background-color: var(--color-gray-700);
    position: relative;
    transition: background-color 0.2s;
  }

  .menu-icon::before,
  .menu-icon::after {
    content: '';
    position: absolute;
    left: 0;
    width: 20px;
    height: 2px;
    background-color: var(--color-gray-700);
    transition: transform 0.2s, top 0.2s;
  }

  .menu-icon::before {
    top: -6px;
  }

  .menu-icon::after {
    top: 6px;
  }

  .menu-icon.open {
    background-color: transparent;
  }

  .menu-icon.open::before {
    top: 0;
    transform: rotate(45deg);
  }

  .menu-icon.open::after {
    top: 0;
    transform: rotate(-45deg);
  }

  .nav {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .nav-link {
    padding: 0.5rem 0.75rem;
    color: var(--color-gray-600);
    text-decoration: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    transition: color 0.15s, background-color 0.15s;
    background: none;
    border: none;
    cursor: pointer;
  }

  .nav-link:hover {
    color: var(--color-gray-900);
    background-color: var(--color-gray-100);
    text-decoration: none;
  }

  .nav-link.active {
    color: var(--color-primary);
    background-color: rgb(59 130 246 / 0.1);
  }

  .logout-btn {
    color: var(--color-danger);
  }

  .logout-btn:hover {
    color: var(--color-danger);
    background-color: rgb(239 68 68 / 0.1);
  }

  .main {
    flex: 1;
    padding: 1.5rem 1rem;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }

  @media (max-width: 768px) {
    .menu-toggle {
      display: block;
    }

    .nav {
      display: none;
      position: absolute;
      top: 60px;
      left: 0;
      right: 0;
      background-color: white;
      flex-direction: column;
      padding: 1rem;
      border-bottom: 1px solid var(--color-gray-200);
      box-shadow: var(--shadow-md);
    }

    .nav.open {
      display: flex;
    }

    .nav-link {
      width: 100%;
      text-align: left;
    }
  }
</style>
