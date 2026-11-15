
CREATE   PROC [CNT].SpContractInsert
    @CompanyRoll TINYINT ,
    @Type TINYINT ,
    @ParentID INT ,
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
    @Creator INT ,
    @CreationDate DATETIME ,
    @ContractNature TINYINT ,
    @Status TINYINT,
	@ProjectId int,
    @BaseType TINYINT
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

    IF @Type = 2
    BEGIN
        DECLARE @LastDate DATE ,
                @Message NVARCHAR(MAX);

        SELECT @LastDate = MAX([Date])
        FROM   CNT.[Contract]
        WHERE  ParentID = @ParentID;


        IF @LastDate IS NULL
            BEGIN
                SELECT @LastDate = [Date]
                FROM   CNT.[Contract]
                WHERE  ContractID = @ParentID;
            END;

        IF @EndDate < @LastDate or @Date <= @LastDate
            BEGIN
                RAISERROR(
                    'CNT_ComplementDateBiggerThanLastComplemetDate' ,
                    16 ,
                    12);
                RETURN;
            END;
    END;
		
    IF EXISTS (SELECT 1
				FROM   CNT.Contract
				WHERE  Number = @Number
					   AND ParentID = @ParentID 
		   )
        BEGIN
            RAISERROR('Number_Duplicated', 16, 12);
            RETURN;
        END;

    INSERT INTO [CNT].[Contract] ( [Type] ,
                                   [ParentID] ,
                                   [CompanyRoll] ,
                                   [ContractTypeID] ,
                                   [Number] ,
                                   [Date] ,
                                   [Title] ,
                                   [Title2] ,
                                   [TenderID] ,
                                   [BranchID] ,
                                   [PartyID] ,
                                   [DLID] ,
                                   [Life] ,
                                   [StartDate] ,
                                   [EndDate] ,
                                   [StatementDeliverySection] ,
                                   [Creator] ,
                                   [CreationDate] ,
                                   [LastEditor] ,
                                   [LastEditionDate] ,
                                   [Version] ,
                                   [ContractNature],
								   [Status],
								   [ProjectId],
                                   [BaseType])
                SELECT @Type ,
                       @ParentID ,
                       @CompanyRoll ,
                       @ContractTypeID ,
                       @Number ,
                       @Date ,
                       @Title ,
                       @Title2 ,
                       @TenderID ,
                       @BranchID ,
                       @PartyID ,
                       @DLID ,
                       @Life ,
                       @StartDate ,
                       @EndDate ,
                       @StatementDeliverySection ,
                       @Creator ,
                       @CreationDate ,
                       @Creator ,
                       @CreationDate ,
                       0 ,
                       @ContractNature,
					   @Status,
					   @ProjectId,
                       @BaseType;

-- Begin Return Select <- do not remove
    SELECT [ContractID] ,
           [Version] 
    FROM   [CNT].[Contract]
    WHERE  [ContractID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove
