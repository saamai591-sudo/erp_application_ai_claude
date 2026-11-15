CREATE     PROC [VND].[SpProposalCommissionInsert]
    @FinancialPeriodID int,
    @Number int,
    @Date DATE,
    @PurchaseRequestID int,
    @Description nvarchar(MAX) = NULL,
    @Description2 nvarchar(MAX) = NULL,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
	@Status tinyint
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
	
	IF (@Number IS NULL)
	   OR @Number = 0
	    SET @Number = ISNULL(
	            (
	                SELECT MAX(pc.Number)
	                FROM   VND.ProposalCommission pc
	                WHERE  pc.FinancialPeriodID = @FinancialPeriodID
	            ),
	            0
	        ) + 1
	
	INSERT INTO [VND].[ProposalCommission] ([FinancialPeriodID], [Number], [Date], [PurchaseRequestID], [Description], [Description2], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Version],Status)
	SELECT @FinancialPeriodID, @Number, @Date, @PurchaseRequestID, @Description, @Description2, @Creator, @CreationDate, @LastEditor, @LastEditionDate, 0,@Status
	
	-- Begin Return Select <- do not remove
	SELECT [ProposalCommissionID], [Version], Number
	FROM   [VND].[ProposalCommission]
	WHERE  [ProposalCommissionID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
