
----------------------------------------------------------------------------------------------
CREATE   PROC [REQ].[spReturnRequestUpdate] 
    @ReturnRequestID int,
    @BranchID int,
    @StockID int,
    @ReturnRequestNumber int,
    @ReturnRequestDate datetime,
    @ReturnRequestState tinyint,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int,
    @FinancialPeriodID INT,
	@OrganizationUnitID INT,
	@DocumentType INT,
    @ReviewDate DATETIME NULL,
    @Reviewer INT NULL
--WITH ENCRYPTION
AS
BEGIN
	SET NOCOUNT ON 

	if @Version <> (Select [Version] from [REQ].[ReturnRequest]
	where [ReturnRequestID] = @ReturnRequestID)
	RAISERROR('Version mismatch...', 16 , 10)	


		DECLARE 
		@CompanyID INT,
		@Message NVARCHAR(MAX)		
		
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
					AND b.CompanyID = @CompanyID
					AND rr.ReturnRequestNumber = @ReturnRequestNumber
					AND rr.ReturnRequestID != @ReturnRequestID)) 
		begin	
			SELECT @Message = 'NumberIsDuplicate'
			RAISERROR(@Message,16,12)
			Return
		end
	END
		
		UPDATE [REQ].[ReturnRequest]
		SET     [BranchID] = @BranchID, 
				[StockID] = @StockID, 
				[ReturnRequestNumber] = @ReturnRequestNumber, 
				[ReturnRequestDate] = @ReturnRequestDate, 
				[ReturnRequestState] = @ReturnRequestState,
				[LastEditor] = @LastEditor, 
				[LastEditionDate] = @LastEditionDate, 
				[Version] = @Version + 1,
				[OrganizationUnitID] = @OrganizationUnitID,
				DocumentType =@DocumentType,
				[ReviewDate]=@ReviewDate,
				[Reviewer]=@Reviewer
		WHERE  [ReturnRequestID] = @ReturnRequestID
	
			-- Begin Return Select <- do not remove
			SELECT  [Version] ,
					[ReturnRequestNumber]
			FROM   [REQ].[ReturnRequest]
			WHERE  [ReturnRequestID] = @ReturnRequestID	
			-- End Return Select <- do not remove		
END;
