
--==============================================Alter spInstallmentPaymentUpdate
CREATE   PROC [CFG].[spInstallmentPaymentUpdate] 
    @InstallmentPaymentID INT,
    @FinancialPeriodID INT,
    @BranchID INT,
    @Number INT,
    @Date DATETIME,
    @InstallmentType TINYINT,
    @BaseType TINYINT,
    @DocumentID INT,
    @PartyID BIGINT,
    @Version INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @CurrencyID INT
AS 
	SET NOCOUNT ON 

    DECLARE 
		@CompanyID INT

	SELECT 
		@CompanyID = b.CompanyID 
	FROM 
		CFG.Branch b 
	WHERE 
		b.BranchID = @BranchID
	
	IF(@Number = 0 OR @Number IS NULL)
	SET 
		@Number = ISNULL(
						(SELECT 
							MAX(Number) + 1
							FROM 
							    cfg.InstallmentPayment InstallmentPayment
							JOIN 
							    CFG.Branch b 
							ON 
							    InstallmentPayment.BranchID = b.BranchID
							WHERE 
							    InstallmentPayment.FinancialPeriodID = @FinancialPeriodID AND 
                                b.CompanyID = @CompanyID)
						, 1) 
	
	IF @Version = (SELECT [Version] FROM [CFG].[InstallmentPayment]
				   WHERE [InstallmentPaymentID] = @InstallmentPaymentID)
	BEGIN	
		SET 
			@Version = @Version + 1 

		UPDATE 
			[CFG].[InstallmentPayment]
		SET     
			[FinancialPeriodID] = @FinancialPeriodID, 
            [BranchID] = @BranchID, 
            [Number] = @Number, 
            [Date] = @Date, 
            [InstallmentType] = @InstallmentType, 
            [BaseType] = @BaseType, 
            [DocumentID] = @DocumentID, 
            [PartyID] = @PartyID, 
            [Version] = @Version, 
            [Creator] = @Creator, 
            [CreationDate] = @CreationDate, 
            [LastEditor] = @LastEditor, 
            [LastEditionDate] = @LastEditionDate,
            CurrencyID = @CurrencyID
		WHERE  
			[InstallmentPaymentID] = @InstallmentPaymentID
	
		-- Begin Return Select <- do not remove
		SELECT 
			[Version], 
			[Number]
		FROM   
			[CFG].[InstallmentPayment]
		WHERE  
			[InstallmentPaymentID] = @InstallmentPaymentID	
		-- End Return Select <- do not remove
	END 
