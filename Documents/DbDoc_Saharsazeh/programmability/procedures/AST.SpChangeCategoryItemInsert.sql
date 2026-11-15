-------------------------------------
CREATE   PROC [AST].[SpChangeCategoryItemInsert] 
    @ChangeCategoryID int,
    @AssetID int,
    @PreviousCategoryID int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime 
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
	
	declare @FinancialPeriod int

	if (select DepreciationMethod
	    from AST.Asset
	    where AssetID = @AssetID) = 3
	begin
		if exists (select 1 from AST.Depreciation where AssetID = @AssetID)
		begin
			RAISERROR('داراییهای دارای محاسبه استهلاک را نمی توانید به گروه بدون استهلاک منتقل نمایید.', 16, 12)
			return
		end
	end

	if exists (select 1 from AST.Depreciation
	where AssetID = @AssetID and FinancialPeriodID = @FinancialPeriod and
	      VoucherID is not null)
	begin
		raiserror('برای برخی از داراییهای انتخاب شده، در دوره مالی جاری محاسبه استهلاک انجام و سند حسابداری صادر شده است. ابتدا سند حسابداری مذکور را حذف نمایید.',16,12)
		return
	end	

	INSERT INTO [AST].[ChangeCategoryItem] ([ChangeCategoryID], [AssetID], [PreviousCategoryID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @ChangeCategoryID, @AssetID, @PreviousCategoryID, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [ChangeCategoryItemID], [Version]
	FROM   [AST].[ChangeCategoryItem]
	WHERE  [ChangeCategoryItemID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
