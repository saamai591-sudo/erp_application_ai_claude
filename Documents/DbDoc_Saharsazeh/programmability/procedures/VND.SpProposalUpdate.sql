
--==============================================ALTER SpProposalUpdate

CREATE   PROC [VND].[SpProposalUpdate]
    @ProposalID INT ,
    @PartyID BIGINT ,
    @BranchID INT ,
    @FinancialPeriodID INT ,
    @QuotationNumber nvarchar(100) = NULL ,
    @QuotationDate DATE = NULL ,
    @ExpireDate DATE = NULL ,
    @Number INT ,
    @Date DATE ,
    @CurrencyID INT ,
    @TotalPrice DECIMAL(30, 4) ,
    @TotalDiscount DECIMAL(30, 4) ,
    @TotalTax DECIMAL(30, 4) ,
    @TotalDuty DECIMAL(30, 4) ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @Version INT ,
    @BaseDocument TINYINT ,
    @Status TINYINT
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

    IF @Version <> (   SELECT [Version]
                       FROM   [VND].[Proposal]
                       WHERE  [ProposalID] = @ProposalID )
        BEGIN
            RAISERROR('Version mismatch...', 16, 10);
            RETURN;
        END;


    SET @Version = @Version + 1;
    DECLARE @StartNum INT = NULL ,
            @EndNum INT = NULL ,
            @ResetType BIT = 0 ,
			@ResetBranch BIT = 0 ,
            @DocumentNumID INT ,
            @DocumentNumTypeID INT ,
            @Message NVARCHAR(MAX);


    SELECT @DocumentNumTypeID = DocumentNumTypeID
    FROM   [CFG].[DocumentNumType]
    WHERE  EngName = 'Proposal';

    SELECT @StartNum = StartNum ,
           @EndNum = EndNum ,
           @DocumentNumID = DocumentNumID
    FROM   CFG.DocumentNum
    WHERE  DocumentNumTypeID = @DocumentNumTypeID
           AND FinancialPeriodID = @FinancialPeriodID;


    IF EXISTS (   SELECT *
                  FROM   CFG.DocumentNumResetNumberBase a
				  join cfg.DocumentNumResetNumberBaseType b
					on a.DocumentNumResetNumberBaseTypeID = b.DocumentNumResetNumberBaseTypeID
                  WHERE  DocumentNumID = @DocumentNumID
                    AND  b.EngName = 'Type' )
        BEGIN
            SET @ResetType = 1;
        END;


    IF EXISTS (   SELECT *
                  FROM   CFG.DocumentNumResetNumberBase a
				  join cfg.DocumentNumResetNumberBaseType b
					on a.DocumentNumResetNumberBaseTypeID = b.DocumentNumResetNumberBaseTypeID
                  WHERE  DocumentNumID = @DocumentNumID
                    AND  b.EngName = 'Branch' )
        BEGIN
            SET @ResetBranch = 1;
        END;

    IF (   @Number = 0 OR @Number IS NULL )
        BEGIN
            SET @Number = ISNULL(
                          (   SELECT MAX(Number) + 1
                              FROM   [VND].[Proposal]
                              WHERE  FinancialPeriodID = @FinancialPeriodID
								AND (   @ResetBranch = 0 OR BranchID = @BranchID )
						  ) ,
                          @StartNum);
        END;
    ELSE
        BEGIN
            IF ( EXISTS (   SELECT 1
                            FROM   [VND].[Proposal]
                            WHERE  FinancialPeriodID = @FinancialPeriodID
							   AND ProposalID <> @ProposalID
							   AND (   @ResetBranch = 0 OR BranchID = @BranchID )
                               AND Number = @Number 
						)
				)
                BEGIN
                    SELECT @Message = 'NumberIsDuplicate'
                    RAISERROR(@Message, 16, 12);
                    RETURN;
                END;
        END;

    IF (   @Number >= @StartNum
           AND (   @EndNum IS NULL
                   OR @Number <= @EndNum ))
		begin
			UPDATE [VND].[Proposal]
			SET    [PartyID] = @PartyID ,
				   [BranchID] = @BranchID ,
				   [FinancialPeriodID] = @FinancialPeriodID ,
				   [QuotationNumber] = @QuotationNumber ,
				   [QuotationDate] = @QuotationDate ,
				   [ExpireDate] = @ExpireDate ,
				   [Number] = @Number ,
				   [Date] = @Date ,
				   [CurrencyID] = @CurrencyID ,
				   [TotalPrice] = @TotalPrice ,
				   [TotalDiscount] = @TotalDiscount ,
				   [TotalTax] = @TotalTax ,
				   [TotalDuty] = @TotalDuty ,
				   [LastEditor] = @LastEditor ,
				   [LastEditionDate] = @LastEditionDate ,
				   [Version] = @Version ,
				   [BaseDocument] = @BaseDocument ,
				   [Status] = @Status
			WHERE  [ProposalID] = @ProposalID;

    -- Begin Return Select <- do not remove
    SELECT [Version]
    FROM   [VND].[Proposal]
    WHERE  [ProposalID] = @ProposalID;
-- End Return Select <- do not remove
END
