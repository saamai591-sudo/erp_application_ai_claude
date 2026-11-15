
----------------------------------------------------------------------------------------------
CREATE   PROC [REQ].[spReturnRequestInsert] 
    @BranchID int,
    @StockID int,
    @ReturnRequestNumber int,
    @ReturnRequestDate datetime,
    @ReturnRequestState tinyint,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
    @FinancialPeriodID INT,
	@OrganizationUnitID INT,
	@DocumentType INT,
	@ReviewDate DATETIME NULL,
    @Reviewer INT NULL
--WITH ENCRYPTION
AS 
BEGIN
	SET NOCOUNT ON 
	SET XACT_ABORT ON  

		DECLARE 
		@CompanyID INT;
			
	SELECT @CompanyID = CompanyID 
	FROM CFG.Branch 
	WHERE BranchID = @BranchID		
	
	IF (@ReturnRequestNumber = 0 OR @ReturnRequestNumber IS NULL)--شماره گذاري سيستمي يا اگر دستي بود ولي مقدار را وارد نکرده بود
	BEGIN
		SET @ReturnRequestNumber = ISNULL((
											SELECT MAX(ReturnRequestNumber) + 1
											FROM [REQ].[ReturnRequest] rr
											JOIN CFG.Branch b 
												ON rr.BranchID = b.BranchID
											WHERE FinancialPeriodID = @FinancialPeriodID 
											AND b.CompanyID = @CompanyID
											),1)
	END
	ELSE
	BEGIN
		IF (Exists (SELECT * 
					FROM [REQ].[ReturnRequest] rr
					JOIN CFG.Branch b 
						ON rr.BranchID = b.BranchID
					WHERE FinancialPeriodID = @FinancialPeriodID 
					AND b.CompanyID = @CompanyID)) 
		begin
			DECLARE @Message NVARCHAR(MAX)
	
			SELECT @Message = 'NumberIsDuplicate'
			RAISERROR(@Message,16,12)
			Return
		end
	END

	INSERT INTO [REQ].[ReturnRequest] ([BranchID], [StockID], [ReturnRequestNumber], [ReturnRequestDate], [ReturnRequestState],  [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Version], [FinancialPeriodID],[OrganizationUnitID],[DocumentType],[ReviewDate],[Reviewer])
	SELECT @BranchID, @StockID, @ReturnRequestNumber, @ReturnRequestDate, @ReturnRequestState, @Creator, @CreationDate, @LastEditor, @LastEditionDate, 0, @FinancialPeriodID,@OrganizationUnitID,@DocumentType,@ReviewDate,@Reviewer
	
		-- Begin Return Select <- do not remove
		SELECT [ReturnRequestID], [Version],  [ReturnRequestNumber]
		FROM   [REQ].[ReturnRequest]
		WHERE  [ReturnRequestID] = SCOPE_IDENTITY()
		-- End Return Select <- do not remove	
END
