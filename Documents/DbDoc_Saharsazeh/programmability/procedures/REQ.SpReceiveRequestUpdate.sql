
--------------------------------------- END #6913

----------------------------------- START #7057
CREATE   PROC [REQ].SpReceiveRequestUpdate
    @ReceiveRequestID INT,
    @FinancialPeriodID INT,
    @Type TINYINT,
    @Number INT,
    @Date DATE,
    @BranchID INT,
    @PartyID BIGINT,
    @CurrencyID INT,
    @Amount DECIMAL(36, 10),
    @Non_Received DECIMAL(36, 10),
    @Description NVARCHAR(MAX) = NULL,
    @Description2 NVARCHAR(MAX) = NULL,
    @Status TINYINT,
    @Version INT,
    @LastEditor INT,
    @LastEditionDate DATETIME,
	@OrganizationUnitID INT,
	@ReviewDate DATETIME NULL,
    @Reviewer INT NULL
--WITH ENCRYPTION
AS 
BEGIN
	SET NOCOUNT ON 

	IF @Version <> (SELECT [Version] FROM [REQ].[ReceiveRequest]
				WHERE [ReceiveRequestID] = @ReceiveRequestID)
	BEGIN
		RAISERROR('Version mismatch...', 16 , 10)
		RETURN 0
	END

	SET @Version = @Version +1 
	     DECLARE @CompanyID INT,
			@Message NVARCHAR(MAX)
			
	SELECT @CompanyID = CompanyID 
	FROM CFG.Branch 
	WHERE BranchID = @BranchID	
	
	IF(@Number IS NOT NULL AND @Number <> 0)
	BEGIN
		IF EXISTS (SELECT * FROM REQ.ReceiveRequest rr
						  JOIN CFG.Branch b 
						  	ON rr.BranchID = b.BranchID
						  WHERE rr.ReceiveRequestID <> @ReceiveRequestID
						  AND FinancialPeriodID = @FinancialPeriodID 
						  AND b.CompanyID = @CompanyID
						  AND rr.Number = @Number
						  )
		BEGIN
			RAISERROR('NumberIsDuplicate',16,12)
			RETURN 0
		END
	END					     
	
	IF(@Number = 0 OR @Number IS NULL)
		SET @Number =ISNULL((SELECT MAX(Number) + 1
						  FROM [REQ].[ReceiveRequest] rr
						  JOIN CFG.Branch b 
						  	ON rr.BranchID = b.BranchID
						  WHERE FinancialPeriodID = @FinancialPeriodID 
						  AND b.CompanyID = @CompanyID
						  ),1)
   

	
		DECLARE @OldAmount DECIMAL(36, 10)
		
		select @OldAmount = r.Amount,
		       @Non_Received = r.Non_Received
	    from REQ.ReceiveRequest r
		where r.ReceiveRequestID = @ReceiveRequestID
		
		SET @Non_Received = (@Non_Received - @OldAmount) + @Amount

		UPDATE [REQ].[ReceiveRequest]
		SET     [Type] = @Type, 
				[Number] = @Number, 
				[Date] = @Date, 
				[BranchID] = @BranchID, 
				[PartyID] = @PartyID, 
				[CurrencyID] = @CurrencyID, 
				[Amount] = @Amount, 
				[Non_Received] = @Non_Received, 
				[Description] = @Description, 
				[Description2] = @Description2, 
				[Status] = @Status, 
				[Version] = @Version, 
				[LastEditor] = @LastEditor, 
				[LastEditionDate] = @LastEditionDate,
				[OrganizationUnitID] = @OrganizationUnitID,
				[ReviewDate]=@ReviewDate,
				[Reviewer]=@Reviewer
		WHERE  [ReceiveRequestID] = @ReceiveRequestID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version] ,
			[Number], 
			[Non_Received]
        FROM   [REQ].[ReceiveRequest]
		WHERE  [ReceiveRequestID] = @ReceiveRequestID	
		-- End Return Select <- do not remove
END;
