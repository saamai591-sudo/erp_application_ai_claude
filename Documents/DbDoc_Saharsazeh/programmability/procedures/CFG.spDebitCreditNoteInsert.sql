CREATE   PROC [CFG].[spDebitCreditNoteInsert]
    @Number INT ,
    @Date DATE ,
    @PreVoucherID INT ,
    @FinancialPeriodID INT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @BranchID INT ,
    @Description NVARCHAR(MAX) ,
    @Description2 NVARCHAR(MAX)
--WITH ENCRYPTION
AS
    SET NOCOUNT ON; 
	
    IF ( @Number = 0
         OR @Number IS NULL
       )
        SET @Number = ISNULL(( SELECT   MAX(Number) + 1
                               FROM     [CFG].[DebitCreditNote]
                               WHERE    FinancialPeriodID = @FinancialPeriodID
                             ), 1);
	
    INSERT  INTO [CFG].[DebitCreditNote]
            ( [Number] ,
              [Date] ,
              [PreVoucherID] ,
              [FinancialPeriodID] ,
              [Version] ,
              [Creator] ,
              [CreationDate] ,
              [LastEditor] ,
              [LastEditionDate] ,
              [BranchID],
			  [Description],
			  [Description2]
            )
            SELECT  @Number ,
                    @Date ,
                    @PreVoucherID ,
                    @FinancialPeriodID ,
                    0 ,
                    @Creator ,
                    @CreationDate ,
                    @LastEditor ,
                    @LastEditionDate ,
                    @BranchID,
					@Description,
					@Description2;
	
	-- Begin Return Select <- do not remove
    SELECT  [DebitCreditNoteID] ,
            [Version],
            [Number]
    FROM    [CFG].[DebitCreditNote]
    WHERE   [DebitCreditNoteID] = SCOPE_IDENTITY();
	-- End Return Select <- do not remove
