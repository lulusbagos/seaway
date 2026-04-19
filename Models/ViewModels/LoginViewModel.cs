using System.ComponentModel.DataAnnotations;

namespace SeaWay.Models.ViewModels;

public class LoginViewModel
{
    [Required(ErrorMessage = "Username wajib diisi.")]
    [Display(Name = "Username")]
    public string UserName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password wajib diisi.")]
    [DataType(DataType.Password)]
    [Display(Name = "Password")]
    public string Password { get; set; } = string.Empty;

    [Display(Name = "Masuk sebagai")]
    public string Role { get; set; } = "Fleet Operator";

    [Display(Name = "Ingat perangkat ini")]
    public bool RememberMe { get; set; }

    public IReadOnlyList<DemoAccountViewModel> DemoAccounts { get; set; } = [];
}

public class DemoAccountViewModel
{
    public required string UserName { get; init; }

    public required string Password { get; init; }

    public required string Role { get; init; }

    public required string Description { get; init; }
}
