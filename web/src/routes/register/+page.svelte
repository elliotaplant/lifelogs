<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/auth';

  let email = '';
  let password = '';
  let confirmPassword = '';
  let error = '';
  let loading = false;

  async function handleSubmit() {
    error = '';

    if (password !== confirmPassword) {
      error = 'Passwords do not match';
      return;
    }

    if (password.length < 8) {
      error = 'Password must be at least 8 characters';
      return;
    }

    loading = true;

    try {
      await authStore.register(email, password);
      goto('/');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Registration failed';
    } finally {
      loading = false;
    }
  }
</script>

<div class="auth-page">
  <div class="auth-card">
    <h1>Create account</h1>
    <p class="subtitle">Start tracking your life</p>

    <form on:submit|preventDefault={handleSubmit}>
      {#if error}
        <div class="error-alert">{error}</div>
      {/if}

      <div class="form-group">
        <label for="email" class="label">Email</label>
        <input
          type="email"
          id="email"
          class="input"
          bind:value={email}
          required
          autocomplete="email"
        />
      </div>

      <div class="form-group">
        <label for="password" class="label">Password</label>
        <input
          type="password"
          id="password"
          class="input"
          bind:value={password}
          required
          minlength="8"
          autocomplete="new-password"
        />
        <span class="hint">At least 8 characters</span>
      </div>

      <div class="form-group">
        <label for="confirmPassword" class="label">Confirm Password</label>
        <input
          type="password"
          id="confirmPassword"
          class="input"
          bind:value={confirmPassword}
          required
          autocomplete="new-password"
        />
      </div>

      <button type="submit" class="btn btn-primary submit-btn" disabled={loading}>
        {loading ? 'Creating account...' : 'Create account'}
      </button>
    </form>

    <div class="auth-footer">
      <p>
        Already have an account? <a href="/login">Sign in</a>
      </p>
    </div>
  </div>
</div>

<style>
  .auth-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background-color: var(--color-gray-50);
  }

  .auth-card {
    background-color: white;
    padding: 2rem;
    border-radius: 0.75rem;
    box-shadow: var(--shadow-lg);
    width: 100%;
    max-width: 400px;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.25rem;
    text-align: center;
  }

  .subtitle {
    color: var(--color-gray-500);
    text-align: center;
    margin: 0 0 1.5rem;
  }

  .error-alert {
    background-color: rgb(239 68 68 / 0.1);
    color: var(--color-danger);
    padding: 0.75rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  .hint {
    font-size: 0.75rem;
    color: var(--color-gray-500);
    margin-top: 0.25rem;
  }

  .submit-btn {
    width: 100%;
    margin-top: 0.5rem;
  }

  .auth-footer {
    margin-top: 1.5rem;
    text-align: center;
  }

  .auth-footer p {
    margin: 0.5rem 0;
    font-size: 0.875rem;
    color: var(--color-gray-500);
  }

  .auth-footer a {
    color: var(--color-primary);
  }
</style>
