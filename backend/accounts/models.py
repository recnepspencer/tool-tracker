from django.db import models


class SignupCode(models.Model):
    """A single-use code that lets one new account set up one company."""

    id = models.UUIDField(primary_key=True)
    code_digest = models.CharField(max_length=64, unique=True)
    label = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True)
    # Verifying an account claims the code. The claim carries the company details entered
    # at signup until that account finishes company setup.
    claimed_by = models.ForeignKey(
        "cleanforce_identity.PlatformUser", null=True, on_delete=models.PROTECT
    )
    claimed_at = models.DateTimeField(null=True)
    company_name = models.CharField(max_length=200, blank=True)
    logo = models.ForeignKey("companies.CompanyLogo", null=True, on_delete=models.SET_NULL)
    company = models.OneToOneField("companies.Company", null=True, on_delete=models.PROTECT)


class SignupChallenge(models.Model):
    token_digest = models.CharField(max_length=64, primary_key=True)
    email = models.EmailField()
    name = models.CharField(max_length=120)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True)
    signup_code = models.ForeignKey(SignupCode, null=True, on_delete=models.CASCADE)
    company_name = models.CharField(max_length=200, blank=True)
    logo = models.ForeignKey("companies.CompanyLogo", null=True, on_delete=models.SET_NULL)


class AuthenticationWindow(models.Model):
    key = models.CharField(max_length=64, primary_key=True)
    attempts = models.PositiveIntegerField(default=0)
    expires_at = models.DateTimeField(db_index=True)
