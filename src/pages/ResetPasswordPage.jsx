import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthAlert from '../components/auth/AuthAlert.jsx'
import AuthInput from '../components/auth/AuthInput.jsx'
import AuthShell from '../components/auth/AuthShell.jsx'
import Button from '../components/common/Button.jsx'
import { forgotPassword } from '../services/authService.js'

const highlights = [
  'Temporary password by email',
  'Protected account recovery',
  'Return to study without losing sessions',
]

function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  function handleChange(event) {
    setEmail(event.target.value)
    setError('')
    setFormError('')
    setSuccessMessage('')
  }

  function validateEmail() {
    const nextEmail = email.trim()
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!nextEmail) {
      setError('Email is required.')
      return false
    }

    if (!emailPattern.test(nextEmail)) {
      setError('Enter a valid email address.')
      return false
    }

    setError('')
    return true
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!validateEmail()) {
      return
    }

    setIsLoading(true)
    setFormError('')
    setSuccessMessage('')

    try {
      const message = await forgotPassword(email.trim())
      setSuccessMessage(message || 'If the email exists, a new password has been sent.')
    } catch (requestError) {
      if (requestError.status === 503) {
        setFormError('Password reset email is not configured yet. Please contact your course administrator.')
      } else {
        setFormError(requestError.message || 'Could not send the password reset email.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthShell
      asideAlign="right"
      asideEyebrow="Account recovery"
      asideText="Request a temporary password for your FStu account. Keep your course workspace, uploaded documents, and cited answers connected to the same email."
      asideTitle="Recover access to your study workspace."
      highlights={highlights}
    >
      <div className="animate-auth-field animation-delay-225">
        <p className="text-sm font-extrabold text-primary">Password reset</p>
        <h2 className="mt-2 text-4xl font-extrabold tracking-tight">
          Get a new password
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Enter the email linked to your FStu account. We will send a temporary password if the account exists.
        </p>
      </div>

      <form className="mt-9 space-y-5" onSubmit={handleSubmit}>
        {successMessage ? <AuthAlert tone="success">{successMessage}</AuthAlert> : null}
        {formError ? <AuthAlert>{formError}</AuthAlert> : null}

        <div className="animate-auth-field animation-delay-300">
          <AuthInput
            error={error}
            label="Account email"
            name="email"
            onChange={handleChange}
            placeholder="student@fpt.edu.vn"
            type="email"
            value={email}
          />
        </div>

        <div className="animate-auth-field animation-delay-375 rounded-2xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-sm font-semibold leading-6 text-teal-900">
          For security, the response is the same even if the email is not registered.
        </div>

        <div className="animate-auth-field animation-delay-450">
          <Button
            className="h-13 w-full rounded-full text-base"
            disabled={isLoading}
            type="submit"
            variant="cta"
          >
            {isLoading ? 'Sending reset email...' : 'Send reset email'}
          </Button>
        </div>
      </form>

      <p className="animate-auth-field animation-delay-450 mt-8 text-center text-sm text-muted-foreground">
        Remember your password?{' '}
        <Link className="font-extrabold text-primary" to="/login">
          Back to login
        </Link>
      </p>
    </AuthShell>
  )
}

export default ResetPasswordPage
