
create   PROC ATN.spAttendanceCalculationDelete
(
    @CalendarMonthID INT,
    @SelectedPersonel NVARCHAR(MAX)
)    
AS
    
    --	@Type = 1		ForCalculation
    --	@Type = 2			ForDelete
    --	@Type = 3			ForSendingToPayroll
    --	@Type = 4		ForReturnFromPayroll
    
    DECLARE @ErrorMessage NVARCHAR(MAX)
    
    
    
    SELECT VALUE PersonelID
    INTO #Personel
    FROM CFG.R_FnCommaStr2Table(@SelectedPersonel)
    
    
    EXEC atn.spAttendaceCalculationControls
		@CalendareMonthID = @CalendarMonthID,
        @SelectedPersonel = @SelectedPersonel,
        @Type = 2
       
       --- Control 1
       
       ------- check if at least one person has been calculated in payroll
       -- For all operations this Control will be executed   
       
       DELETE FROM acp1 FROM atn.AttendanceCalculationPersonnel AS acp1
       JOIN #Personel p
            ON  acp1.PersonelID = p.PersonelID
       WHERE  acp1.CalendarMonthID = @CalendarMonthID