-------------------------------------
CREATE   view [STF].VWStuff

--with encryption
as
SELECT      S.StuffID, 
			s.[Type],
			s.[Type] [TypeString],
			case when cfg1.ConfigValue = 'True' then s.Code
					else isnull(sg.FullCode,'') + isnull(cfg.ConfigValue,'') + s.Code 
				 end code,
			sg.StuffGroupID, 
			s.Code StuffCode,
			CASE
				WHEN sg.FullCode IS NULL
					OR sg.FullCode = '' THEN
					NULL
				ELSE
					sg.FullCode
			END StuffGroupCode,
			sg.Title StuffGroupTitle,
			sg.Title2 StuffGroupTitle2,
			isnull(s.StandardTitle ,'') + isnull(' ' + s.Title,'') Title, 
			isnull(s.StandardTitle2 ,'') + isnull(' ' + s.Title2,'') Title2 , 
			MU1.Title MainMeasureUnit, 
			MU1.Title2 MainMeasureUnit2, 
			MU2.Title SubMeasureUnit,
			MU2.Title2 SubMeasureUnit2,
			case SAG.stuffdetailtype when 0 then N'مواد اولیه'
						when 1 then N'کالای نیمه ساخته'
						when 2 then N'محصول'
						when 3 then N'ضایعات'
						when 4 then N'دارایی ثابت'
						when 5 then N'سایر'
						when 6 then N'خدمت'
						when 7 then N'تجاری'
						when 8 then N'ملزومات'
			end StuffDetailTypeTitle,
			SAG.StuffDetailType,
			SAG.Code StuffAccountGroupCode,
			SAG.Title StuffAccountGroupTitle,
			SAG.Title2 StuffAccountGroupTitle2,
			Barcode,
			IranCode,
			g.code SalesGroupCode,
			g.Title SalesGroupTitle,
			g.Title2 SalesGroupTitle2,
			sd.TechnicalCode,
			StuffNature,
			DutyRate,
			TaxRate,
			ExemptOfPurchaseVat,
			ExemptOfSellVat,
			MainMeasureUnitID,
			StockReceiptCostAgent,
			FixedAssetConversion,
			DiscountGroupID,
			Saleable,
			ConvertRatio,
			IsStable,
			MeasureSubUnitID,
			sd.StuffAccountGroupID,
			s.ParentID ,
			SalesGroupID,
			IsActive,
			IsSpecialStuff,
			CASE WHEN mu1.UnitType = 1 THEN mu1.Kilogram ELSE NULL END MainUnitKilogram,
			CASE WHEN mu2.UnitType = 1 THEN mu2.Kilogram ELSE NULL END SubUnitKilogram,
			cast(CASE WHEN wmu.UnitType = 1 THEN s.WeighRatio*1000 * wmu.Kilogram ELSE NULL END as decimal(36,10))/1000 WeighUnitKilogram,
			UniqueTaxID,
			SD.IsStuffSerializable
FROM   STF.Stuff S
join stf.StuffDetail SD on S.StuffID = SD.StuffID
join stf.MeasureUnit MU1 on MU1.MeasureUnitID = S.MainMeasureUnitID
left join stf.StuffAccountGroup SAG on SAG.StuffAccountGroupID = sd.StuffAccountGroupID
left join stf.MeasureUnit MU2 on MU2.MeasureUnitID = SD.MeasureSubUnitID
left join cfg.[Group] g on g.GroupID = sd.SalesGroupID
left join stf.vwstuffgroup sg on sg.StuffGroupID = s.StuffGroupID
join [CFG].[Configuration] cfg on cfg.[ConfigKey] = 'StuffGroupCodeSeprator'
join [CFG].[Configuration] cfg1 on cfg1.[ConfigKey] = 'IndependentStuffCoding'
LEFT JOIN stf.MeasureUnit AS wmu ON wmu.MeasureUnitID = S.WeightUnitID
