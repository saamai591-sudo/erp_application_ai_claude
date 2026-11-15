CREATE   PROC [CNT].[SpAdditionDeductionTypeUpdate]
    @AdditionDeductionTypeID INT ,
    @IsActive BIT ,
    @Type TINYINT ,
    @Criterion TINYINT ,
    @Title NVARCHAR(500) ,
    @Title2 NVARCHAR(500) ,
    @Payable BIT ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @Version INT
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

    DECLARE @count INT ,
            @msg NVARCHAR(MAX);

    SELECT @count = COUNT(1)
    FROM   CNT.AdditionDeductionType
    WHERE  Title = @Title
           AND AdditionDeductionTypeID <> @AdditionDeductionTypeID;

    IF @count > 0
        BEGIN
            RAISERROR('Title_Duplicated', 16, 12);
            RETURN;
        END;

    SELECT @count = COUNT(1)
    FROM   CNT.AdditionDeductionType
    WHERE  Title2 = @Title2
           AND AdditionDeductionTypeID <> @AdditionDeductionTypeID;

    IF @count > 0
        BEGIN
            RAISERROR('Title2_Duplicated', 16, 12);
            RETURN;
        END;

    IF @Version <> (   SELECT [Version]
                       FROM   [CNT].[AdditionDeductionType]
                       WHERE  [AdditionDeductionTypeID] = @AdditionDeductionTypeID )
        BEGIN
            RAISERROR('Version mismatch...', 16, 10);
            RETURN;
        END;

    SET @Version = @Version + 1;

    UPDATE [CNT].[AdditionDeductionType]
    SET    [IsActive] = @IsActive ,
           [Criterion] = @Criterion ,
           [Type] = @Type ,
           [Title] = @Title ,
           [Title2] = @Title2 ,
           [Payable] = @Payable ,
           [LastEditor] = @LastEditor ,
           [LastEditionDate] = @LastEditionDate ,
           [Version] = @Version
    WHERE  [AdditionDeductionTypeID] = @AdditionDeductionTypeID;

    -- Begin Return Select <- do not remove
    SELECT [Version]
    FROM   [CNT].[AdditionDeductionType]
    WHERE  [AdditionDeductionTypeID] = @AdditionDeductionTypeID;
-- End Return Select <- do not remove
