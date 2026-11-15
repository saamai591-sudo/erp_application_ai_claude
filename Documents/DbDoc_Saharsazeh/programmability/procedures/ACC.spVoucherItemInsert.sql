CREATE    PROC [ACC].[spVoucherItemInsert]
    @VoucherID INT,
    @VoucherItemIndex INT,
   
    @SlID INT,
    @Description NVARCHAR(MAX),
    @Description2 NVARCHAR(MAX),
    @Debit DECIMAL(36, 10),
    @Credit DECIMAL(36, 10),
    @CurrencyID INT,
    @CurrencyRate DECIMAL(36, 10),
    @CurrencyDebit DECIMAL(36, 10),
    @CurrencyCredit DECIMAL(36, 10),
    @Creator INT,
    @CreationDate DATETIME
	--WITH ENCRYPTION 
AS 
	SET NOCOUNT ON 

	IF @CurrencyID = 0
	    SET @CurrencyID = -1
	
	INSERT INTO [ACC].[VoucherItem]
	  (
	    [VoucherID],
	    [VoucherItemIndex],
	   
	    [SlID],
	    [Description],
	    [Description2],
	    [Debit],
	    [Credit],
	    [CurrencyID],
	    [CurrencyRate],
	    [CurrencyDebit],
	    [CurrencyCredit],
	    [Creator],
	    [CreationDate],
	    [LastEditor],
	    [LastEditionDate],
	    [Version]
	  )
	SELECT @VoucherID,
	       @VoucherItemIndex,
	      
	       @SlID,
	       @Description,
	       @Description2,
	       @Debit,
	       @Credit,
	       @CurrencyID,
	       @CurrencyRate,
	       @CurrencyDebit,
	       @CurrencyCredit,
	       @Creator,
	       @CreationDate,
	       @Creator,
	       @CreationDate,
	       0
	
	-- Begin Return Select <- do not remove
	SELECT [VoucherItemID],
	       [Version]
	FROM   [ACC].[VoucherItem]
	WHERE  [VoucherItemID] = SCOPE_IDENTITY()
	       -- End Return Select <- do not remove
