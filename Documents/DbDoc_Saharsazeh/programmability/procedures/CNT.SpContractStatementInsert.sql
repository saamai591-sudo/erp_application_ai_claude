CREATE PROC [CNT].[SpContractStatementInsert]
    @ContractStatementTypeID INT,
    @ContractID INT,
    @Number INT,
    @Date DATE,
    @FromDate DATE,
    @EndDate DATE,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @FinancialPeriodID INT,
    @CurrencyID INT,
    @PartyID BIGINT,
    @BaseType TINYINT,
    @ContractStatementAnalysisID INT =NULL
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

    DECLARE @LastEndDate DATE,
            @Count       INT,
            @Message     NVARCHAR(MAX),
		    @Nature      TinyInt;


    SELECT @Nature = Type
    FROM CNT.ContractStatementType
    where ContractStatementTypeID = @ContractStatementTypeID

    SET @Number = ISNULL(
                    (
                        SELECT MAX(Number)
                        FROM CNT.ContractStatement a
					    join CNT.ContractStatementType b
						    on a.ContractStatementTypeID = b.ContractStatementTypeID
                        WHERE ContractID = @ContractID
					    and 
					    (
						    (@Nature in (1,4) and b.Type in (1,4))
						    or
						    (b.Type = @Nature)
					    )
                    ),
                    0
                        ) + 1;

IF  @Nature  IN (1,4)
BEGIN
    SELECT top 1  @LastEndDate = EndDate
    FROM cnt.Contract
    WHERE parentid = @ContractID
    order by date desc


    IF @LastEndDate IS NULL
    BEGIN
        SELECT @LastEndDate = MAX(EndDate)
        FROM CNT.[Contract]
        WHERE ContractID = @ContractID ;
    END;


    IF @EndDate > @LastEndDate
    BEGIN
        RAISERROR('CNT_ToDateBiggerThanContractLastEndDate', 16, 12);
        RETURN;
    END;
END;


INSERT INTO [CNT].[ContractStatement]
(
    [ContractStatementTypeID],
    [ContractID],
    [Number],
    [FromDate],
    [EndDate],
    [Creator],
    [CreationDate],
    [LastEditor],
    [LastEditionDate],
    [Version],
    [FinancialPeriodID],
    [PartyID],
    [CurrencyID],
    [Date],
    [BaseType],
    [ContractStatementAnalysisID]
)
SELECT @ContractStatementTypeID,
       @ContractID,
       @Number,
       @FromDate,
       @EndDate,
       @Creator,
       @CreationDate,
       @LastEditor,
       @LastEditionDate,
       0,
       @FinancialPeriodID,
       @PartyID,
       @CurrencyID,
       @Date,
       @BaseType,
       @ContractStatementAnalysisID;

 -- Begin Return Select <- do not remove
    SELECT [ContractStatementID],
           [Version],
           [Number]
    FROM [CNT].[ContractStatement]
    WHERE [ContractStatementID] = SCOPE_IDENTITY();
    -- End Return Select <- do not remove
