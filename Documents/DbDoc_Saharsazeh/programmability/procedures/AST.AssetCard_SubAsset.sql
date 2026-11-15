-------------------------------------
CREATE    PROC [AST].[AssetCard_SubAsset]
    (
        @AssetID INT
    )
--WITH ENCRYPTION 
AS
    BEGIN

	DECLARE @Culture varchar(25),
		@CultureNo tinyint

	set @Culture = CFG.GetuserCulture() 

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

        SELECT a.Plaque ,              
			   case when @CultureNo = 1 then a.Title
	                when @CultureNo = 2 then a.Title2
	           end as Title,
               CASE a.AssetType
                    WHEN 1 THEN N'دارایی ثابت'
                    WHEN 2 THEN N'دارایی نامشهود'
                    WHEN 3 THEN N'سایر دارائیها'
               END AssetType ,                 
			   case when @CultureNo = 1 then ac.Title
	                when @CultureNo = 2 then ac.Title2
	           end as AssetCategory,
               ar.Number AssetReceiptNumber ,
			   ar.Date AssetReceiptDate, 
               CFG.GetSaturnDate(ar.Date, 0) Date_AssetReceiptDate ,
               CASE a.Nature
                    WHEN 1 THEN N'استقراری'
                    WHEN 2 THEN N'عملیاتی'
                    WHEN 3 THEN N'دریافت از شعبه'
                    WHEN 4 THEN N'تغییر گروه'
               END Nature,
               a.BaseValue ,
               a.AccumulatedDepreciation ,
               a.SalvageValue ,
               CASE a.DepreciationMethod
                    WHEN 1 THEN N'نزولی'
                    WHEN 2 THEN N'مستقیم'
                    WHEN 3 THEN N'بدون استهلاک'
               END DepreciationMethod ,
               a.DepreciationRate
        FROM   AST.Asset a
               JOIN AST.AssetCategory ac ON a.AssetCategoryID = ac.AssetCategoryID
               LEFT JOIN AST.AssetReceipt ar ON a.AssetReceiptID = ar.AssetReceiptID
               LEFT JOIN AST.Asset a2 ON a2.AssetID = a.HeadAssetID
        WHERE  a.HeadAssetID = @AssetID;
    END;

