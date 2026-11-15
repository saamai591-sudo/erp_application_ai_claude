
------------------------------------- START #7135
CREATE   PROC ATN.spAttendanceChangeRequestConfirm
    @IDs VARCHAR(MAX),
    @OperationType TINYINT
AS
BEGIN
    DECLARE 
        @UserID INT = CFG.GetuserID(),
        @Message NVARCHAR(MAX);

	DROP TABLE IF EXISTS #IDs

	SELECT value AS ID
	INTO #IDs
	FROM CFG.R_FnCommaStr2Table(@IDs);

	--SELECT * FROM #IDs

    -- Loop through all IDs
    DECLARE cur CURSOR FOR SELECT ID FROM #IDs;

    DECLARE @ID INT;
    OPEN cur;
    FETCH NEXT FROM cur INTO @ID;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        DECLARE 
            @PersonelID INT,
            @Date DATE,
            @EntryHour DECIMAL(18,0),
            @ExitHour DECIMAL(18,0),
            @PersonelIDForCheckCalculation INT;

        -- Load data
        SELECT 
            @PersonelID = a.PersonelID,
            @Date = a.Date,
            @EntryHour = a.EntryHour,
            @ExitHour = a.ExitHour
        FROM ATN.AttendanceChangeRequest a
        WHERE a.AttendanceChangeRequestID = @ID;

        SELECT 
            @PersonelIDForCheckCalculation = ac.PersonelID
        FROM ATN.AttendanceCalculationPersonnel ac
        JOIN HRM.CalendarMonth c ON ac.CalendarMonthID = c.CalendarMonthID
        WHERE ac.PersonelID = @PersonelID 
        AND c.AttendanceEndDate >= @Date;

        ---------------------------------------------------------
        -- CONFIRM
        ---------------------------------------------------------
        IF (@OperationType = 1)
        BEGIN
            IF @EntryHour IS NOT NULL 
               AND @EntryHour > 0 
               AND NOT EXISTS (
                    SELECT 1 FROM ATN.EntryAndExit 
                    WHERE PersonelID = @PersonelID 
                    AND Date = @Date 
                    AND [Hour] = @EntryHour
               )
            BEGIN
                INSERT INTO ATN.EntryAndExit
                (
                    PersonelID, Date, Hour, Version, Creator, CreationDate,
                    LastEditor, LastEditionDate, AttendanceChangeRequestID
                )
                SELECT 
                    @PersonelID, @Date, @EntryHour, 0,
                    a.Creator, a.CreationDate, a.Creator, a.CreationDate, @ID
                FROM ATN.AttendanceChangeRequest a
                WHERE a.AttendanceChangeRequestID = @ID;
            END

            IF @ExitHour IS NOT NULL 
               AND @ExitHour > 0 
               AND NOT EXISTS (
                    SELECT 1 FROM ATN.EntryAndExit 
                    WHERE PersonelID = @PersonelID 
                    AND Date = @Date 
                    AND [Hour] = @ExitHour
               )
            BEGIN
                INSERT INTO ATN.EntryAndExit
                (
                    PersonelID, Date, Hour, Version, Creator, CreationDate,
                    LastEditor, LastEditionDate, AttendanceChangeRequestID
                )
                SELECT 
                    @PersonelID, @Date, @ExitHour, 0,
                    a.Creator, a.CreationDate, a.Creator, a.CreationDate, @ID
                FROM ATN.AttendanceChangeRequest a
                WHERE a.AttendanceChangeRequestID = @ID;
            END

            UPDATE ATN.AttendanceChangeRequest
            SET ReviewDate = GETDATE(), ReviewerID = @UserID
            WHERE AttendanceChangeRequestID = @ID;
        END

        ---------------------------------------------------------
        -- CANCEL CONFIRM
        ---------------------------------------------------------
        IF (@OperationType = 2)
        BEGIN
            IF @PersonelIDForCheckCalculation IS NOT NULL
            BEGIN
                SET @Message = N'درخواست اصلاح کارکرد دارای محاسبه میباشد';
                RAISERROR(@Message, 16, 12);
                RETURN;
            END

            DELETE FROM ATN.EntryAndExit WHERE AttendanceChangeRequestID = @ID;

            UPDATE ATN.AttendanceChangeRequest
            SET ReviewDate = NULL, ReviewerID = NULL
            WHERE AttendanceChangeRequestID = @ID;
        END

        FETCH NEXT FROM cur INTO @ID;
    END

    CLOSE cur;
    DEALLOCATE cur;
END
