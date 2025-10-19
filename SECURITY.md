# Security Policy

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

We take the security of D2R Arcane Tracker seriously. If you believe you have found a security vulnerability, please report it to us through GitHub Security Advisories.

### How to Report

1. Go to the [Security Advisories page](https://github.com/hyperremix/d2r-arcane-tracker/security/advisories)
2. Click "Report a vulnerability"
3. Fill out the advisory form with as much detail as possible

Alternatively, you can report via email to the repository maintainer if you prefer private communication.

### What to Include in Your Report

To help us better understand and resolve the issue, please include:

- **Type of vulnerability** (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- **Full paths of source file(s)** related to the vulnerability
- **Location of the affected source code** (tag/branch/commit or direct URL)
- **Step-by-step instructions** to reproduce the issue
- **Proof-of-concept or exploit code** (if possible)
- **Impact of the vulnerability** and how an attacker might exploit it
- **Any special configuration** required to reproduce the issue

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 48 hours
- **Updates**: We will keep you informed about our progress in addressing the vulnerability
- **Timeline**: We aim to release a fix within 90 days of disclosure, depending on complexity
- **Credit**: With your permission, we will publicly credit you for the discovery once the fix is released

## Security Update Process

When a security vulnerability is reported:

1. We will confirm the vulnerability and determine its severity
2. We will develop and test a fix
3. We will prepare a security advisory
4. We will release a patched version
5. We will publish the security advisory with appropriate credits

Security updates will be released as patch versions (e.g., 0.3.1) and announced through:

- GitHub Security Advisories
- GitHub Releases page
- Repository README

## Scope

### In Scope

Security vulnerabilities in:

- The Electron application and its main/renderer processes
- IPC communication between processes
- File system operations and save file parsing
- Database operations (SQLite)
- Auto-update mechanism
- Third-party dependencies bundled with the application

### Out of Scope

The following are generally **not** considered security vulnerabilities:

- Issues that require physical access to the user's machine
- Issues in third-party applications (Diablo II: Resurrected itself)
- Social engineering attacks
- Denial of service attacks on local application
- Issues that require the user to install malicious software
- Issues in outdated/unsupported versions

## Security Best Practices for Users

To ensure the security of your system while using D2R Arcane Tracker:

1. **Download from Official Sources**: Only download releases from the official GitHub repository
2. **Keep Updated**: Always use the latest version to benefit from security patches
3. **Verify Checksums**: Check file hashes for downloaded releases when available
4. **File Permissions**: Ensure the application has only necessary file system permissions
5. **Antivirus**: Keep your antivirus software up to date (the app is safe, but your system should be protected)
6. **Save File Backups**: Regularly backup your D2R save files as a precaution

## Known Security Considerations

- The application requires read access to your D2R save files to function
- The application uses a local SQLite database to store tracking data
- The application may check for updates automatically (can be disabled in settings)
- The application does not collect or transmit personal data to external servers

## Questions?

If you have questions about this security policy or need clarification, please open a [GitHub Discussion](https://github.com/hyperremix/d2r-arcane-tracker/discussions).

---

**Thank you for helping keep D2R Arcane Tracker and our users safe!**
