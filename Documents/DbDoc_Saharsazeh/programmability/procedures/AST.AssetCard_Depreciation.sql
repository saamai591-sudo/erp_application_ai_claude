-------------------------------------
CREATE     PROC [AST].AssetCard_Depreciation
    (
        @AssetID INT
    )
--WITH ENCRYPTION 
AS
    BEGIN


	with ad as
    (
    select  ai.AdjustmentItemID,
            ROW_NUMBER() over(partition by a.AdjustmentID order by ai.AdjustmentItemID) Rno,
            CFG.GetSaturnDate(a.[Date], 0) Date,
            a.Number
    from ast.AdjustmentItem ai
    left join ast.Adjustment a on a.AdjustmentID = ai.AdjustmentID
    where ai.AssetID = @AssetID

    )
    ,cte as
	(
        SELECT CFG.GetSaturnDate(fp.StartDate, 0) Date_Date ,
               fp.StartDate as Date,
               a.AccumulatedDepreciation Value ,
                N'عادی-انباشته استقراری' Depreciationtype,
				N'دستی' [Formul],
                null AssetSettingID,
                1 [Type],
                null DepreciationID
        FROM   AST.Asset a
        join cfg.FinancialPeriod fp on a.AssetCreationDate between startdate and EndDate
        WHERE  a.AssetID = @AssetID
        and a.AccumulatedDepreciation > 0

		union all

        SELECT CFG.GetSaturnDate(a.AssetCreationDate, 0) Date_Date ,
               a.[AssetCreationDate] ,
               a.DuringDepreciation Value ,
                N'عادی-طی دوره استقراری' Depreciationtype,
				N'دستی',
                null AssetSettingID,
                2,
                null DepreciationID
        FROM   AST.Asset a
        WHERE  a.AssetID = @AssetID
        and a.DuringDepreciation > 0

		union all

        SELECT CFG.GetSaturnDate(d.[Date], 0) Date_Date ,
               d.[Date] ,
               d.Value ,
               CASE d.DepreciationType
                    WHEN 1 THEN N'عادی'
                    WHEN 2 THEN N'تعمیر'
                    WHEN 3 THEN N'ردیف '+cast(ad.rno as varchar(2))+N' تغییر بهاء به شماره '+cast(ad.Number as varchar(10))+N' به تاریخ '+ad.Date
                    WHEN 4 THEN N'مازاد ناشی از تجدید ارزیابی'
               END Depreciationtype,
			   [Formul],
               d.AssetSettingID,
               3,
               DepreciationID
        FROM   AST.Depreciation d
        left join ad on ad.AdjustmentItemID = d.AdjustmentItemID
        WHERE  d.AssetID = @AssetID
        and d.Value <> 0
	),
    cte1 as
    (
        select *,
		        ROW_NUMBER() over(partition by assetid order by date) Rno
        from ast.AssetSetting
        WHERE  AssetID = @AssetID
    )

	select  a.Date_Date,
            a.[Date],
            a.Value,
            a.Depreciationtype + N' به ازای ردیف موقیعت ' +cast(b.rno as varchar(2)) Depreciationtype,
            a.[Formul],
			sum(value) over(order by Type,a.DepreciationID) [DepreciationInLine]
	from cte a
    left join cte1 b on a.AssetSettingID = b.AssetSettingID
    END;

