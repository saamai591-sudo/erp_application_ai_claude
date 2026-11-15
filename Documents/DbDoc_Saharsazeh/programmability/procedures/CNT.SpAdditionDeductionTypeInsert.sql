CREATE   PROC [CNT].[SpAdditionDeductionTypeInsert]
    @IsActive BIT ,
    @Type TINYINT ,
    @Criterion TINYINT ,
    @Title NVARCHAR(500) ,
    @Title2 NVARCHAR(500) ,
    @Payable BIT ,
    @Creator INT ,
    @CreationDate DATETIME
--WITH ENCRYPTION
AS
    SET NOCOUNT ON;

    DECLARE @count INT ,
            @msg NVARCHAR(MAX);

    SELECT @count = COUNT(1)
    FROM   CNT.AdditionDeductionType
    WHERE  Title = @Title;

    IF @count > 0
        BEGIN
            RAISERROR('Title_Duplicated', 16, 12);
            RETURN;
        END;

    SELECT @count = COUNT(1)
    FROM   CNT.AdditionDeductionType
    WHERE  Title2 = @Title2;

    IF @count > 0
        BEGIN
            RAISERROR('Title2_Duplicated', 16, 12);
            RETURN;
        END;

    INSERT INTO [CNT].[AdditionDeductionType] 
    (   [IsActive] ,
        [Type] ,
        [Criterion] ,
        [Title] ,
        [Title2] ,
        [Payable] ,
        [Creator] ,
        [CreationDate] ,
        [LastEditor] ,
        [LastEditionDate] ,
        [Version] )
    SELECT @IsActive ,
            @Type ,
            @Criterion ,
            @Title ,
            @Title2 ,
            @Payable ,
            @Creator ,
            @CreationDate ,
            @Creator ,
            @CreationDate ,
            0;

    -- Begin Return Select <- do not remove
    SELECT [AdditionDeductionTypeID] ,
           [Version]
    FROM   [CNT].[AdditionDeductionType]
    WHERE  [AdditionDeductionTypeID] = SCOPE_IDENTITY();
-- End Return Select <- do not remove
