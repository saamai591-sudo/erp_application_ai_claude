CREATE   PROC [CNT].[SpContractStatementItemUpdate]
    @ContractStatementItemID INT ,
    @ContractStatementID INT ,
    @RowIndex SMALLINT ,
    @Description NVARCHAR(500) ,
    @Description2 NVARCHAR(500) ,
    @Amount DECIMAL(30, 4) ,
    @BaseOfAdditionDeduction BIT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @Version INT ,
    @ContractSubjectID INT ,
    @Tax DECIMAL(30, 4) ,
    @Duty DECIMAL(30, 4)
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

    IF @Version <> (   SELECT [Version]
                       FROM   [CNT].[ContractStatementItem]
                       WHERE  [ContractStatementItemID] = @ContractStatementItemID )
        BEGIN
            RAISERROR('Version mismatch...', 16, 10);
            RETURN;
        END;

    IF [CNT].[ContractStatementHasFlow](@ContractStatementID) = 1
        BEGIN
            RAISERROR('Contract.ContractStatementInFlow', 16, 10);
            RETURN;
        END;

    DECLARE @Message NVARCHAR(MAX) ,
            @totalPrice DECIMAL(30, 4),
            @ContractStatementTypeID INT;

    SELECT @totalPrice = Price
    FROM   CNT.VWContractSubject AS vcs
           JOIN CNT.Contract AS c ON c.ContractID = vcs.ContractID
    WHERE  ContractSubjectID = @ContractSubjectID
           AND c.ContractNature <> 2;

    SELECT @ContractStatementTypeID=cst.[Type]
    FROM CNT.ContractStatement as cs
    join CNT.ContractStatementType as cst on cst.ContractStatementTypeID=cs.ContractStatementTypeID
    WHERE @ContractStatementID=@ContractStatementID

    IF @Amount > @totalPrice AND @ContractStatementTypeID<>2
        BEGIN
            SELECT @Message = 'CNT_PriceSumBiggerThanSubjectPrice';
            RAISERROR(@Message, 16, 12);
            RETURN;
        END;

    SET @Version = @Version + 1;

    UPDATE [CNT].[ContractStatementItem]
    SET    [ContractStatementID] = @ContractStatementID ,
           [RowIndex] = @RowIndex ,
           [Description] = @Description ,
           [Description2] = @Description2 ,
           [Amount] = @Amount ,
           [BaseOfAdditionDeduction] = @BaseOfAdditionDeduction ,
           [LastEditor] = @LastEditor ,
           [LastEditionDate] = @LastEditionDate ,
           [Version] = @Version ,
           ContractSubjectID = @ContractSubjectID ,
           Tax = @Tax ,
           Duty = @Duty
    WHERE  [ContractStatementItemID] = @ContractStatementItemID;

    -- Begin Return Select <- do not remove
    SELECT [Version]
    FROM   [CNT].[ContractStatementItem]
    WHERE  [ContractStatementItemID] = @ContractStatementItemID;
-- End Return Select <- do not remove
