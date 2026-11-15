

CREATE   PROC [STF].[spTraceItemInsert]
    @TraceListTypeID INT,
    @Item NVARCHAR(1024),
    @Item2 NVARCHAR(1024),
    @Creator INT,
    @CreationDate DATETIME,
    @RowIndex SMALLINT,
    @Code NVARCHAR(255)

--WITH ENCRYPTION 
AS
BEGIN
    DECLARE @msg NVARCHAR(MAX);

    IF EXISTS
    (
        SELECT 1
        FROM STF.TraceItem AS ti
        WHERE ti.Item = @Item
		and TraceListTypeID = @TraceListTypeID
    )
    BEGIN
        SET @msg = N'StuffManager.TraceItemTitleIsDuplicate^' + CAST(@RowIndex AS NVARCHAR(100));
        RAISERROR(@msg, 16, 12);
        RETURN;
    END;


    IF EXISTS
    (
        SELECT 1
        FROM STF.TraceItem AS ti
        WHERE ti.Item2 = @Item2
		and TraceListTypeID = @TraceListTypeID
    )
    BEGIN
        SET @msg = N'StuffManager.TraceItemTitleIsDuplicate^' + CAST(@RowIndex AS NVARCHAR(100));
        RAISERROR(@msg, 16, 12);
        RETURN;
    END;


    IF EXISTS
    (
        SELECT 1
        FROM STF.TraceItem AS ti
        WHERE ti.Code = @Code
		and TraceListTypeID = @TraceListTypeID
    )
    BEGIN
        SET @msg = N'StuffManager.TraceItemCodeIsDuplicate^' + CAST(@RowIndex AS NVARCHAR(100));
        RAISERROR(@msg, 16, 12);
        RETURN;
    END;

    INSERT INTO [STF].[TraceItem]
    (
        [TraceListTypeID],
        [Item],
        [Item2],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version],
        [RowIndex],
        [Code]
    )
    SELECT @TraceListTypeID,
           @Item,
           @Item2,
           @Creator,
           @CreationDate,
           @Creator,
           @CreationDate,
           0,
           @RowIndex,
           @Code;

    -- Begin Return Select <- do not remove
    SELECT [TraceItemID],
           [Version]
    FROM [STF].[TraceItem]
    WHERE [TraceItemID] = SCOPE_IDENTITY();
    -- End Return Select <- do not remove

END;
