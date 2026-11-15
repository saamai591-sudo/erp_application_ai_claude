CREATE PROC [STF].[spStockInsert] 
    @Title nvarchar(256),
    @Title2 nvarchar(256),
    @BranchID int,
    @Code int,
    @Supervisor nvarchar(256),
    @Phone nvarchar(50),
    @Address nvarchar(256),
    @IsStockDefault bit,
    @IsActive bit,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate DATETIME,
	@NegativeInventoryChecking BIT,
	@HasZone BIT ,
	@StockTypeID int
			--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON 
	SET XACT_ABORT ON  
	
	INSERT INTO [STF].[Stock]
	(
		[Title],
		[Title2],
		[BranchID],
		[Code],
		[Supervisor],
		[Phone],
		[Address],
		[IsStockDefault],
		[IsActive],
		[Version],
		[Creator],
		[CreationDate],
		[LastEditor],
		[LastEditionDate],
		[NegativeInventoryChecking],
		[HasZone],
		[StockTypeID]
	)
	SELECT @Title, 
		   @Title2,
		   @BranchID, 
		   @Code, 
		   @Supervisor, 
		   @Phone, 
		   @Address, 
		   @IsStockDefault, 
		   @IsActive, 
		   0, 
		   @Creator, 
		   @CreationDate, 
		   @LastEditor, 
		   @LastEditionDate,
		   @NegativeInventoryChecking,
		   @HasZone,
		   @StockTypeID
	
	-- Begin Return Select <- do not remove
	SELECT [StockID], 
		   [Version]
	FROM   [STF].[Stock]
	WHERE  [StockID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
