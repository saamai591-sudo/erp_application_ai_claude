CREATE    PROC [CNT].[SpContractStatementItemInsert]
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
    @ContractSubjectID INT ,
    @Tax DECIMAL(30, 4) ,
    @Duty DECIMAL(30, 4)
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

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

    IF @Amount > @totalPrice and @ContractStatementTypeID<>2
        BEGIN
            SELECT @Message = 'CNT_PriceSumBiggerThanSubjectPrice';
            RAISERROR(@Message, 16, 12);
            RETURN;
        END;

    INSERT INTO [CNT].[ContractStatementItem] ( [ContractStatementID] ,
                                                [RowIndex] ,
                                                [Description] ,
                                                [Description2] ,
                                                [Amount] ,
                                                [BaseOfAdditionDeduction] ,
                                                [Creator] ,
                                                [CreationDate] ,
                                                [LastEditor] ,
                                                [LastEditionDate] ,
                                                [Version] ,
                                                [ContractSubjectID] ,
                                                [Tax] ,
                                                [Duty] )
                SELECT @ContractStatementID ,
                       @RowIndex ,
                       @Description ,
                       @Description2 ,
                       @Amount ,
                       @BaseOfAdditionDeduction ,
                       @Creator ,
                       @CreationDate ,
                       @LastEditor ,
                       @LastEditionDate ,
                       0 ,
                       @ContractSubjectID ,
                       @Tax ,
                       @Duty;

    -- Begin Return Select <- do not remove
    SELECT [ContractStatementItemID] ,
           [Version]
    FROM   [CNT].[ContractStatementItem]
    WHERE  [ContractStatementItemID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove
