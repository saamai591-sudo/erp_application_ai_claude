CREATE   PROC [STF].FindStuffsByCodes
(
    @Codes VARCHAR(MAX)
)
AS
BEGIN

	select *
	INTO #Codes
	from
	(
		SELECT [value]
		FROM   cfg.R_FnCommaStr2Table(@Codes)
	)a
	group by [value]

    DECLARE @culureNo INT,@ConfigValue BIT ;

    SELECT @culureNo = ci.CultureNo
    FROM CFG.CultureInfo AS ci
    WHERE ci.Culture = CFG.GetuserCulture();

	select @ConfigValue = case when ConfigValue = 'True' 
									then 1 
							  else 0 end
	from cfg.Configuration
	where ConfigType = 4
	and ConfigKey = 'IndependentStuffCoding'

	DECLARE @Seprator char 
	
	select @Seprator = ConfigValue
	 from [CFG].[Configuration] 
	 where [ConfigKey] = 'StuffGroupCodeSeprator';

	select StuffGroupID,stf.StuffGroupFullCode(StuffGroupID) FullCode,Title,Title2
	into #StuffGroup
	from  stf.StuffGroup

    SELECT s.StuffID,
           s.Type,
           case when @ConfigValue = 1 then s.code
						else 
						case when @Seprator is null or @Seprator = ''
						then isnull(sg.FullCode ,'') + s.code
						else
						isnull(sg.FullCode + @Seprator,'')+s.code
						end
		   end Code,
		   CASE WHEN @culureNo = 1 THEN
				isnull(s.StandardTitle ,'') + isnull(' ' + s.Title,'') 
				else
				isnull(s.StandardTitle2 ,'') + isnull(' ' +s.Title2,'') 
           END AS Title,
           s.ExemptOfPurchaseVat,
           s.ExemptOfSellVat,
           s.MainMeasureUnitID,
           s.StuffGroupID,
           SAG.StuffDetailType,
           sd.DiscountGroupID,
           sd.MeasureSubUnitID,
           sd.BarCode,
           sd.IranCode,
           sd.Saleable,
           sd.ConvertRatio,
           sd.IsStable,
           sd.TechnicalCode,
           s.StuffNature,
           s.DutyRate,
           s.TaxRate,
           case when @ConfigValue = 1 then s.code
						else 
						case when @Seprator is null or @Seprator = ''
						then isnull(sg.FullCode ,'') + s.code
						else
						isnull(sg.FullCode + @Seprator,'')+s.code
						end
						end StuffFullCode,
           s.StockReceiptCostAgent,
           s.FixedAssetConversion,
           mu.MeasureUnitID,
           CASE WHEN @culureNo = 1 THEN mu.Title
               ELSE mu.Title2
           END AS MainMeasureUnitTitle
    FROM stf.Stuff AS s
	join stf.StuffDetail sd on sd.StuffID = s.StuffID
	JOIN STF.StuffAccountGroup SAG ON SAG.StuffAccountGroupID = sd.StuffAccountGroupID
	left join #StuffGroup sg on sg.StuffGroupID = s.StuffGroupID
	join #Codes c on c.[value] = case when @ConfigValue = 1 then s.code
						else 
						case when @Seprator is null or @Seprator = ''
						then isnull(sg.FullCode ,'') + s.code
						else
						isnull(sg.FullCode + @Seprator,'')+s.code
						end
						end
    JOIN STF.MeasureUnit AS mu
        ON mu.MeasureUnitID = s.MainMeasureUnitID;

end
