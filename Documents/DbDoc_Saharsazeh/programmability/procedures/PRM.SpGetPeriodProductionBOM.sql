CREATE   proc PRM.SpGetPeriodProductionBOM
(
@CostCalculationPeriodID int
)
as
DECLARE @query NVARCHAR(MAX),
		@Columns NVARCHAR(MAX),
		@SelectColumns NVARCHAR(MAX),
		@joinColumns nvarchar(max)

SELECT @Columns = STUFF(
(
	SELECT DISTINCT
			',' + QUOTENAME(TraceID)
	FROM STF.Trace t
	where t.IsEffectiveInConsumeCost = 1
	FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),1   ,1   ,'');

IF (@Columns IS NULL)
	SET @Columns = N'[-1]';

SELECT @SelectColumns = STUFF(
(
	SELECT DISTINCT
			',pfimt.' + QUOTENAME(TraceID)
	FROM STF.Trace t
	where t.IsEffectiveInConsumeCost = 1
	FOR XML PATH(''), TYPE
).value('.', 'NVARCHAR(MAX)'),1   ,0  ,'');

IF (@SelectColumns IS NULL)
	SET @SelectColumns = N'';


SELECT @joinColumns = STUFF(
			(
				SELECT ' AND ISNULL(pp.' + QUOTENAME(t.TraceID) + ', 0) = ISNULL(pft.' + QUOTENAME(t.TraceID) + ', 0) '
				FROM   STF.Trace t
				where t.IsEffectiveInConsumeCost = 1
				ORDER BY
						t.TraceID
						FOR XML PATH('')
			),1,0,'');

IF @joinColumns IS NULL
	SET @joinColumns = N'';

	delete  PRM.PeriodProductionBOM where CostCalculationPeriodID = @CostCalculationPeriodID

	set @query = N' insert into PRM.PeriodProductionBOM
					select  @CostCalculationPeriodID,
							pp.PeriodProductionID,
							pp.CostCenterId,
							pfim.StuffID,
							sag.StuffDetailType,
							pfim.Quantity/ProductQuantity*pp.Quantity,
							0,
							0
							'+@SelectColumns+'
					from  PRM.PeriodProduction pp
					join 
					(
						select  pf.ProductionFormulaID,StuffID,pf.Quantity ProductQuantity,iit.TraceID,
								case when AccountLevelTypeID = 1 then cast (DLID as nvarchar(max))
										when AccountLevelTypeID = 6 then cast (TraceItemID as nvarchar(max))
										else Value end value
						from prm.ProductionFormula pf
						left join prm.ProductionFormulaTrace iit
							on pf.ProductionFormulaID = iit.ProductionFormulaID
						left join stf.trace t on t.traceid = iit.traceid
						
					)x 
					pivot
					(
						max(value)
						for traceid in (' + @Columns+ N')
					) pft
						on pft.stuffid = pp.stuffid
						'+@joinColumns+'
					join prm.ProductionFormulaitem pfi
						on pfi.ProductionFormulaID = pft.ProductionFormulaID and ismain = 1
					join prm.ProductionFormulaItemMaterial pfim
						on pfim.ProductionFormulaitemID = pfi.ProductionFormulaitemID
					left join 
					(
						select  ProductionFormulaItemMaterialid,iit.TraceID,
								case when AccountLevelTypeID = 1 then cast (DLID as nvarchar(max))
										when AccountLevelTypeID = 6 then cast (TraceItemID as nvarchar(max))
										else Value end value
						from prm.ProductionFormulaItemMaterialTrace iit
						join stf.trace t on t.traceid = iit.traceid
					)x 
					pivot
					(
						max(value)
						for traceid in (' + @Columns+ N')
					)pfimt
						on pfimt.ProductionFormulaItemMaterialid = pfim.ProductionFormulaItemMaterialid
					join stf.StuffDetail sd
						on sd.Stuffid = pfim.StuffID
						join stf.StuffaccountGroup sag on sd.stuffAccountGroupID = sag.StuffAccountGroupID
					where pp.CostCalculationPeriodID	= @CostCalculationPeriodID'
						EXECUTE sp_executesql @query,
						N'@CostCalculationPeriodID int',
						@CostCalculationPeriodID = @CostCalculationPeriodID
