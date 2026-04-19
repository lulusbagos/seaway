using Microsoft.EntityFrameworkCore;
using SeaWay.Data;
using SeaWay.Data.Entities;

namespace SeaWay.Services;

public class UnitMasterService(SeaWayDbContext dbContext)
{
    public Task<List<UnitMaster>> GetAllAsync()
    {
        return dbContext.UnitMasters
            .OrderByDescending(x => x.IsDefault)
            .ThenBy(x => x.UnitName)
            .ToListAsync();
    }

    public Task<UnitMaster?> GetActiveAsync()
    {
        return dbContext.UnitMasters
            .Where(x => x.IsActive)
            .OrderByDescending(x => x.IsDefault)
            .ThenBy(x => x.UnitName)
            .FirstOrDefaultAsync();
    }

    public Task<UnitMaster?> GetByIdAsync(int unitId)
    {
        return dbContext.UnitMasters.FirstOrDefaultAsync(x => x.UnitId == unitId);
    }

    public async Task SaveAsync(UnitMaster unit)
    {
        if (unit.UnitId == 0)
        {
            unit.CreatedAt = DateTime.UtcNow;
            dbContext.UnitMasters.Add(unit);
        }
        else
        {
            unit.UpdatedAt = DateTime.UtcNow;
            dbContext.UnitMasters.Update(unit);
        }

        await dbContext.SaveChangesAsync();
    }
}
