------------------------------------- 
CREATE     PROC [AST].[SpChangeCategoryItemUpdate] 
    @ChangeCategoryItemID int,
    @ChangeCategoryID int,
    @AssetID int,
    @PreviousCategoryID int,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
SET NOCOUNT ON 

	declare @PreAsset int,
			@PreVersion int,
			@FinancialPeriod int

	select @PreVersion = i.[Version],
		   @PreAsset = AssetID,
		   @FinancialPeriod = FinancialPeriodID 
	from AST.ChangeCategoryItem i
	join AST.ChangeCategory c on i.ChangeCategoryID = c.ChangeCategoryID
	where ChangeCategoryItemID = @ChangeCategoryItemID

	if (@Version <> @PreVersion)
	begin
		RAISERROR('Version mismatch...', 16 , 10)
		return
	end

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

	if (@AssetID <> @PreAsset)
	begin
		if ((select VoucherID from AST.Depreciation
		where AssetID = @AssetID and FinancialPeriodID = @FinancialPeriod) is not null)
		begin
			raiserror('برای برخی از داراییهای انتخاب شده، در دوره مالی جاری محاسبه استهلاک انجام و سند حسابداری صادر شده است. ابتدا سند حسابداری مذکور را حذف نمایید.',16,12)
			return
		end
	end

	set @Version = @Version +1 

	UPDATE [AST].[ChangeCategoryItem]
	SET    [ChangeCategoryID] = @ChangeCategoryID, 
		   [AssetID] = @AssetID, 
		   [PreviousCategoryID] = @PreviousCategoryID, 
		   [Version] = @Version, 
		   [LastEditor] = @LastEditor, 
		   [LastEditionDate] = @LastEditionDate
	WHERE  [ChangeCategoryItemID] = @ChangeCategoryItemID
	
	-- Begin Return Select <- do not remove
	SELECT [Version]
	FROM   [AST].[ChangeCategoryItem]
	WHERE  [ChangeCategoryItemID] = @ChangeCategoryItemID	
		-- End Return Select <- do not remove
