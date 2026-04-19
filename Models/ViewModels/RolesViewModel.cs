namespace SeaWay.Models.ViewModels;

public class RolesViewModel
{
    public required IReadOnlyList<RoleCardViewModel> Roles { get; init; }

    public required IReadOnlyList<PermissionViewModel> Permissions { get; init; }
}

public class RoleCardViewModel
{
    public required string Name { get; init; }

    public required string Scope { get; init; }

    public required string Description { get; init; }

    public required string MemberCount { get; init; }

    public required string AccentColor { get; init; }
}

public class PermissionViewModel
{
    public required string Title { get; init; }

    public required string Description { get; init; }

    public required string CaptainState { get; init; }

    public required string OperatorState { get; init; }

    public required string AdminState { get; init; }
}
