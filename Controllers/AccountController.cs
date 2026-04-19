using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SeaWay.Data;
using SeaWay.Data.Entities;
using SeaWay.Models.ViewModels;
using SeaWay.Services;

namespace SeaWay.Controllers;

public class AccountController(SeaWayDbContext dbContext, SeawayDemoDataService demoDataService) : Controller
{
    [AllowAnonymous]
    [HttpGet]
    public IActionResult Login()
    {
        return View(CreateLoginViewModel());
    }

    [AllowAnonymous]
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Login(LoginViewModel model, string? returnUrl = null)
    {
        model.DemoAccounts = demoDataService.GetDemoAccounts();

        if (!ModelState.IsValid)
        {
            return View(model);
        }

        var user = await dbContext.UserLogins
            .Include(x => x.UserRoles)
            .ThenInclude(x => x.Role)
            .Where(x => x.IsActive && x.Username == model.UserName && x.PasswordText == model.Password)
            .FirstOrDefaultAsync();

        if (user is null)
        {
            await WriteLoginAuditAsync(null, model.UserName, null, "failed");
            ModelState.AddModelError(string.Empty, "Username atau password tidak cocok.");
            return View(model);
        }

        var role = user.UserRoles
            .Where(x => x.IsActive && x.Role.IsActive)
            .OrderByDescending(x => x.IsDefault)
            .Select(x => x.Role)
            .FirstOrDefault();

        var roleName = role?.RoleName ?? "Viewer";
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new(ClaimTypes.Name, user.FullName),
            new(ClaimTypes.Role, roleName),
            new("username", user.Username),
            new("role_code", role?.RoleCode ?? "viewer")
        };

        var principal = new ClaimsPrincipal(
            new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme));

        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            principal,
            new AuthenticationProperties
            {
                IsPersistent = model.RememberMe,
                ExpiresUtc = DateTimeOffset.UtcNow.AddHours(8)
            });

        await WriteLoginAuditAsync(user, user.Username, roleName, "success");

        return LocalRedirect(Url.IsLocalUrl(returnUrl) ? returnUrl : Url.Action("Index", "Dashboard")!);
    }

    [Authorize]
    [HttpPost]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return RedirectToAction(nameof(Login));
    }

    private LoginViewModel CreateLoginViewModel()
    {
        return new LoginViewModel
        {
            DemoAccounts = demoDataService.GetDemoAccounts()
        };
    }

    private async Task WriteLoginAuditAsync(UserLogin? user, string username, string? roleName, string status)
    {
        dbContext.LoginAudits.Add(new LoginAudit
        {
            UserId = user?.UserId,
            Username = username,
            RoleName = roleName,
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Request.Headers.UserAgent.ToString(),
            LoginAt = DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Unspecified),
            LoginStatus = status
        });

        await dbContext.SaveChangesAsync();
    }
}
