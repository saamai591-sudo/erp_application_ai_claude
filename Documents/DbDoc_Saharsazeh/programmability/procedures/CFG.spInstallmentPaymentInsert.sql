
--==============================================Alter spInstallmentPaymentInsert
CREATE   PROC [CFG].[spInstallmentPaymentInsert] 
    @FinancialPeriodID INT,
    @BranchID INT,
    @Number INT,
    @Date DATETIME,
    @InstallmentType TINYINT,
    @BaseType TINYINT,
    @DocumentID INT,
    @PartyID BIGINT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @CurrencyID INT
AS 
BEGIN
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
	
    INSERT INTO 
        [CFG].[InstallmentPayment]
    (
        [FinancialPeriodID],
        [BranchID],
        [Number],
        [Date],
        [InstallmentType],
        [BaseType],
        [DocumentID],
        [PartyID],
        [Version],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [CurrencyID]
    )
    SELECT 
        @FinancialPeriodID,
        @BranchID,
        @Number,
        @Date,
        @InstallmentType,
        @BaseType,
        @DocumentID,
        @PartyID,
        0,
        @Creator,
        @CreationDate,
        @LastEditor,
        @LastEditionDate,
        @CurrencyID
	
	-- Begin Return Select <- do not remove
    SELECT 
		[InstallmentPaymentID],
        [Version], 
		[Number]
    FROM   
		[CFG].[InstallmentPayment]
    WHERE  
		[InstallmentPaymentID] = SCOPE_IDENTITY()
    -- End Return Select <- do not remove
END
