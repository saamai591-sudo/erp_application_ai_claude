CREATE PROC [CNT].[SpContractStatementUpdate]
    @ContractStatementID INT,
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
    @Version INT,
    @FinancialPeriodID INT,
    @CurrencyID INT,
    @PartyID BIGINT,
    @BaseType TINYINT,
    @ContractStatementAnalysisID INT =NULL
--WITH ENCRYPTION
AS
SET NOCOUNT ON;

IF @Version <>
(
    SELECT [Version]
    FROM [CNT].[ContractStatement]
    WHERE [ContractStatementID] = @ContractStatementID
)
BEGIN
    RAISERROR('Version mismatch...', 16, 10);
    RETURN;
END;


DECLARE @LastEndDate DATE,
        @Count INT,
        @Message NVARCHAR(MAX),
        @Nature      TinyInt;


IF [CNT].[ContractStatementHasFlow](@ContractStatementID) = 1
BEGIN
    RAISERROR('Contract.ContractStatementInFlow', 16, 10);
    RETURN;
END;

SELECT @Nature = Type
FROM CNT.ContractStatementType
where ContractStatementTypeID = @ContractStatementTypeID

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
        WHERE ContractID = @ContractID;
    END;


    IF @EndDate > @LastEndDate
    BEGIN
        SELECT @Message = N'CNT_ToDateBiggerThanContractLastEndDate';
        RAISERROR(@Message, 16, 12);
        RETURN;
    END;
END;

SET @Version = @Version + 1;

UPDATE [CNT].[ContractStatement]
SET [ContractStatementTypeID] = @ContractStatementTypeID,
    [ContractID] = @ContractID,
    [FromDate] = @FromDate,
    [EndDate] = @EndDate,
    [Creator] = @Creator,
    [CreationDate] = @CreationDate,
    [LastEditor] = @LastEditor,
    [LastEditionDate] = @LastEditionDate,
    [Version] = @Version,
    [FinancialPeriodID] = @FinancialPeriodID,
    CurrencyID = @CurrencyID,
    PartyID = @PartyID,
    [Date] = @Date,
    [BaseType]=@BaseType,
    [ContractStatementAnalysisID]=@ContractStatementAnalysisID
WHERE [ContractStatementID] = @ContractStatementID;

-- Begin Return Select <- do not remove
SELECT [Version]
FROM [CNT].[ContractStatement]
WHERE [ContractStatementID] = @ContractStatementID;
-- End Return Select <- do not remove
