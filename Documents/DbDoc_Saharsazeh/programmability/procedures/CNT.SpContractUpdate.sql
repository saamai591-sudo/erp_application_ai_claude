
CREATE   PROC [CNT].SpContractUpdate
    @ContractID INT ,
    @Type TINYINT ,
    @ParentID INT ,
    @CompanyRoll TINYINT ,
    @ContractTypeID INT ,
    @Number NVARCHAR(250) ,
    @Date DATE ,
    @Title NVARCHAR(500) ,
    @Title2 NVARCHAR(500) ,
    @TenderID INT ,
    @BranchID INT ,
    @PartyID BIGINT ,
    @DLID BIGINT ,
    @Life SMALLINT ,
    @StartDate DATE = NULL ,
    @EndDate DATE = NULL ,
    @StatementDeliverySection TINYINT ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @Version INT ,
    @ContractNature TINYINT,
	@Status TINYINT,
	@ProjectId int,
    @BaseType TINYINT
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

    IF @Version <> (   SELECT [Version]
                       FROM   [CNT].[Contract]
                       WHERE  [ContractID] = @ContractID )
    BEGIN
        RAISERROR('Version mismatch...', 16, 10);
        RETURN;
    END;

    DECLARE @HasFlow BIT = (SELECT CNT.ContractHasFlow(@ContractID) )
    IF (@HasFlow = 1)
    BEGIN
        RAISERROR('HasFlowItemCanNotEdit', 16, 12);
        RETURN;
    END;

    IF @Type = 2
    BEGIN
        DECLARE @LastDate DATE ,
                @Message NVARCHAR(MAX);

        SELECT @LastDate = MAX([Date])
        FROM   CNT.[Contract]
        WHERE  ParentID = @ParentID
        AND ContractID <> @ContractID
        AND [Status] = 2


        IF @LastDate IS NULL
        BEGIN
            SELECT @LastDate = [Date]
            FROM   CNT.[Contract]
            WHERE  ContractID = @ParentID
            AND [Status] = 2
        END;

        IF @EndDate < @LastDate or @Date <= @LastDate
        BEGIN
            SELECT @Message = 'CNT_ComplementDateBiggerThanLastComplemetDate';


            RAISERROR(@Message, 16, 12);
            RETURN;
        END;
    END;

    SET @Version = @Version + 1;

    DECLARE @msg NVARCHAR(500) ,
            @contractTypeSameCodeInDB INT ,
            @NumberCount INT;

    IF @Type = 1
    BEGIN
        SELECT @contractTypeSameCodeInDB = COUNT(*)
        FROM   CNT.Contract
        WHERE  ContractTypeID = @ContractTypeID
                AND ContractID <> @ContractID
                AND Type = 1;
    END;
    ELSE IF @Type = 2
    BEGIN
        SET @contractTypeSameCodeInDB = 0;
    END;
			 
    IF EXISTS (SELECT 1
				FROM   CNT.Contract
				WHERE  Number = @Number
					   AND ContractID <> @ContractID
					   AND ParentID = @ParentID 
		   )
        BEGIN
            SELECT @msg = 'Number_Duplicated';
            RAISERROR(@msg, 16, 12);
            RETURN;
        END;

    IF @Type = 1
    BEGIN
        UPDATE CNT.Contract
        SET    Title = @Title ,
                Title2 = @Title2
        WHERE  ParentID = @ContractID;
    END;

    UPDATE [CNT].[Contract]
    SET    [CompanyRoll] = @CompanyRoll ,
           [Type] = @Type ,
           [ParentID] = @ParentID ,
           [ContractTypeID] = @ContractTypeID ,
           [Number] = @Number ,
           [Date] = @Date ,
           [Title] = @Title ,
           [Title2] = @Title2 ,
           [TenderID] = @TenderID ,
           [BranchID] = @BranchID ,
           [PartyID] = @PartyID ,
           [DLID] = @DLID ,
           [Life] = @Life ,
           [StartDate] = @StartDate ,
           [EndDate] = @EndDate ,
           [StatementDeliverySection] = @StatementDeliverySection ,
           [LastEditor] = @LastEditor ,
           [LastEditionDate] = @LastEditionDate ,
           [Version] = @Version ,
           [ContractNature] = @ContractNature,
		   [Status] = @Status,
		   ProjectId = @ProjectId,
           [BaseType]=@BaseType
    WHERE  [ContractID] = @ContractID;

    -- Begin Return Select <- do not remove
    SELECT [Version] 
    FROM   [CNT].[Contract]
    WHERE  [ContractID] = @ContractID;
    -- End Return Select <- do not remove
