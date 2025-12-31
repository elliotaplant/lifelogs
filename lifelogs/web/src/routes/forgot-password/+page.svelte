<script lang="ts">
  import { auth } from '$lib/api';

  let email = '';
  let error = '';
  let success = false;
  let loading = false;

  async function handleSubmit() {
    error = '';
    loading = true;

    try {
      await auth.forgotPassword(email);
      success = true;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Request failed';
    } finally {
      loading = false;
    }
  }
</script>

<div class="auth-page">
  <div class="auth-card">
    <h1>Reset Password</h1>

    {#if success}
      <div class="success-message">
        <p>If an account with that email exists, we've sent password reset instructions.</p>
        <p>Check your email and follow the link to reset your password.</p>
      </div>
      <a href="/login" class="btn btn-primary back-link">Back to Login</a>
    {:else}
      <p class="subtitle">Enter your email to receive a password reset link</p>

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

        <button type="submit" class="btn btn-primary submit-btn" disabled={loading}>
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <div class="auth-footer">
        <p>
          Remember your password? <a href="/login">Sign in</a>
        </p>
      </div>
    {/if}
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

  .success-message {
    background-color: rgb(34 197 94 / 0.1);
    color: var(--color-success);
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
  }

  .success-message p {
    margin: 0 0 0.5rem;
  }

  .success-message p:last-child {
    margin-bottom: 0;
  }

  .back-link {
    width: 100%;
    text-align: center;
    display: block;
    text-decoration: none;
  }

  .error-alert {
    background-color: rgb(239 68 68 / 0.1);
    color: var(--color-danger);
    padding: 0.75rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
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
