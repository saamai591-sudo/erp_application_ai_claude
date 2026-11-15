
CREATE   PROCEDURE [STF].[GetStuffs]
--WITH ENCRYPTION
AS
    DECLARE @FixedAssets NVARCHAR(100) ,
            @Ingredient NVARCHAR(100) ,
            @OtherStuff NVARCHAR(100) ,
            @Product NVARCHAR(100) ,
            @SemiManufacturedStuff NVARCHAR(100) ,
            @Spoilages NVARCHAR(100) ,
            @Tradeable NVARCHAR(100) ,
            @Supllies NVARCHAR(100) ,
            @WageStuff NVARCHAR(100),
            @Service NVARCHAR(30) ,
            @Culture VARCHAR(10) ,
            @stuff NVARCHAR(100) ,
            @Order NVARCHAR(100),
			@CultureNo tinyint;	    

    SET @Culture = CFG.GetuserCulture();

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

    select * into #vwEnums
    from cfg.VwEnums
    where enum in('StuffDetailTypes','StuffType')

    -- Stuff , // کالا
    
	DECLARE @ConfigValue BIT ,@Seprator char 
	
	select @Seprator = ConfigValue
	 from [CFG].[Configuration] 
	 where [ConfigKey] = 'StuffGroupCodeSeprator';

	select @ConfigValue = case when ConfigValue = 'True' 
									then 1 
							  else 0 end
	from cfg.Configuration
	where ConfigType = 4
	and ConfigKey = 'IndependentStuffCoding'

	select StuffGroupID,stf.StuffGroupFullCode(StuffGroupID) FullCode,Title,Title2
	into #StuffGroup
	from  stf.StuffGroup

    SELECT s.StuffID ,
           s.[Type] ,
			case when @ConfigValue = 1 then s.code
				else
					case when @Seprator is null or @Seprator = ''
						then isnull(sg.FullCode ,'')+ s.code
					else
						isnull(sg.FullCode + @Seprator,'')+s.code
				end
			end Code,
          stfType.Value TypeString ,           
			isnull(s.StandardTitle ,'') + isnull(' '+s.Title,'') Title, 
			isnull(s.StandardTitle2 ,'') + isnull(' '+s.Title2,'') Title2 , 
           s.ExemptOfPurchaseVat ,
           s.ExemptOfSellVat ,
           s.MainMeasureUnitID ,
           s.StuffGroupID ,
           s.StockReceiptCostAgent ,
           s.FixedAssetConversion ,
           ISNULL(CAST(sag.StuffDetailType AS TINYINT), 0) StuffDetailType ,
           sd.DiscountGroupID AS DiscountGroupID ,
           sd.MeasureSubUnitID MeasureSubUnitID ,
           sd.Barcode ,
           sd.IranCode ,
           ISNULL(sd.Saleable, 0) Saleable ,
           sd.ConvertRatio ,
           sd.IsStable ,
		   case @CultureNo
				when 1 then mu.Title
				when 2 then mu.Title2
		   end as MainMeasureUnitTitle ,
		   case @CultureNo
				when 1 then sg.Title
				when 2 then sg.Title2
		   end as StuffGroupTitle ,
		   case @CultureNo
				when 1 then sag.Title
				when 2 then sag.Title2
		   end as StuffAccountGroupTitle ,
		   case @CultureNo
				when 1 then mu2.Title
				when 2 then mu2.Title2
		   end as SubMeasureUnitTitle ,
           sd.SlID ,
           ve.Value AS StuffTypeName ,
		   sg.FullCode StuffGroupFullCode ,
           s.Creator ,
           sd.TechnicalCode ,
           CAST(CASE WHEN (   SELECT COUNT(1)
                              FROM   STF.StuffTrace
                              WHERE  StuffID = s.StuffID ) > 0 THEN 1
                     ELSE 0
                END AS BIT) AS HasTrace ,
           s.IsSpecialStuff ,
           s.DutyRate ,
           s.TaxRate,
		   s.IsActive,
		   pg.PursuitGroups,
		   s.StuffNature

    FROM   STF.[Stuff] s
    join #vwEnums stfType on s.Type = stftype.KeyValue and stfType.Enum = 'StuffType'
           JOIN STF.StuffDetail sd ON s.StuffID = sd.StuffID
           LEFT JOIN STF.MeasureUnit mu ON s.MainMeasureUnitID = mu.MeasureUnitID
           LEFT JOIN STF.MeasureUnit AS mu2 ON mu2.MeasureUnitID = sd.MeasureSubUnitID
           LEFT JOIN #StuffGroup sg ON sg.StuffGroupID = s.StuffGroupID
           JOIN STF.StuffAccountGroup sag ON sd.StuffAccountGroupID = sag.StuffAccountGroupID           
           left join #vwEnums ve on sag.StuffDetailType = ve.KeyValue and ve.Enum = 'StuffDetailTypes'
		   LEFT JOIN (
		   SELECT StuffID, PursuitGroups = 
				STUFF((SELECT ',' + CAST(b.PursuitGroupID AS NVARCHAR(5)) 
					   FROM STF.StuffPursuitGroup b 
					   WHERE b.StuffID = a.StuffID 
					  FOR XML PATH('')), 1, 0, '')+','
			FROM STF.StuffPursuitGroup a
			GROUP BY StuffID
		   ) pg ON pg.StuffID = s.StuffID
   WHERE  s.IsActive = 1;

