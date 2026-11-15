CREATE PROC [PRM].[spCostDriverInsert]
    @Code INT,
    @Title NVARCHAR(256),
    @Title2 NVARCHAR(256),
    @CostDriverType INT,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME
AS
    SET NOCOUNT ON;

    IF @Code = 0
        SET @Code = ISNULL(( SELECT MAX(cd.Code)FROM PRM.CostDriver AS cd), 0) + 1;

    IF EXISTS (SELECT 1 FROM PRM.CostDriver AS cd WHERE cd.Code = @Code)
    BEGIN
        RAISERROR('Code_Duplicated', 16, 12);
        RETURN;
    END;

    IF EXISTS (SELECT 1 FROM PRM.CostDriver AS cd WHERE cd.Title = @Title)
    BEGIN
        RAISERROR('Title_Duplicated', 16, 12);
        RETURN;
    END;

    IF EXISTS (SELECT 1 FROM PRM.CostDriver AS cd WHERE cd.Title2 = @Title2)
    BEGIN
        RAISERROR('Title2_Duplicated', 16, 12);
        RETURN;
    END;

    INSERT INTO [PRM].[CostDriver]
    (
        [Code],
        [Title],
        [Title2],
        [CostDriverType],
        [Version],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate]
    )
    SELECT @Code,
           @Title,
           @Title2,
           @CostDriverType,
           0,
           @Creator,
           @CreationDate,
           @LastEditor,
           @LastEditionDate;

    -- Begin Return Select <- do not remove
    SELECT [CostDriverID],
           [Version],
           [Code]
    FROM [PRM].[CostDriver]
    WHERE [CostDriverID] = SCOPE_IDENTITY();
    -- End Return Select <- do not remove
