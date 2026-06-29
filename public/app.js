// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  // Check if Firebase is loaded
  if (typeof firebase !== 'undefined') {
    const db = firebase.firestore();
    
    // UI Elements
    const loginOverlay = document.getElementById('loginOverlay');
    const loginTabStudent = document.getElementById('loginTabStudent');
    const loginTabTeacher = document.getElementById('loginTabTeacher');
    const studentLoginForm = document.getElementById('studentLoginForm');
    const teacherLoginForm = document.getElementById('teacherLoginForm');
    const loginStudentId = document.getElementById('loginStudentId');
    const loginStudentPin = document.getElementById('loginStudentPin');
    const loginTeacherPin = document.getElementById('loginTeacherPin');
    
    const userStatusArea = document.getElementById('userStatusArea');
    const loggedInUserName = document.getElementById('loggedInUserName');
    const logoutBtn = document.getElementById('logoutBtn');
    
    const toolbarArea = document.getElementById('toolbarArea');
    const mainNav = document.getElementById('mainNav');
    const studentNameInput = document.getElementById('studentName');
    
    const tabDashboard = document.getElementById('tabDashboard');
    const tabFriends = document.getElementById('tabFriends');
    
    const dashboardView = document.getElementById('dashboardView');
    const friendsView = document.getElementById('friendsView');
    const friendsGrid = document.getElementById('friendsGrid');
    const teacherView = document.getElementById('teacherView');
    
    // Student Checklist Container
    const studentRoutineListContainer = document.getElementById('studentRoutineListContainer');
    const studentRoutineProgressText = document.getElementById('studentRoutineProgressText');

    const emotionButtons = document.querySelectorAll('.g-emotion-btn');
    const diaryText = document.getElementById('diaryText');
    const diarySubmit = document.getElementById('diarySubmit');
    const questionText = document.getElementById('questionText');
    const questionSubmit = document.getElementById('questionSubmit');
    const studentQuestionHistory = document.getElementById('studentQuestionHistory');
    
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');

    // Student Slider (Carousel) Elements
    const sliderTrack = document.getElementById('sliderTrack');
    const sliderPrevBtn = document.getElementById('sliderPrevBtn');
    const sliderNextBtn = document.getElementById('sliderNextBtn');
    const indicatorDots = document.querySelectorAll('.indicator-dot');

    // Teacher Tabs & Content Elements
    const tTabRoutines = document.getElementById('tTabRoutines');
    const tTabManage = document.getElementById('tTabManage');
    const tTabEmotions = document.getElementById('tTabEmotions');
    const tTabQuestions = document.getElementById('tTabQuestions');

    const tContentRoutines = document.getElementById('tContentRoutines');
    const tContentManage = document.getElementById('tContentManage');
    const tContentEmotions = document.getElementById('tContentEmotions');
    const tContentQuestions = document.getElementById('tContentQuestions');
    
    const teacherRoutineTableHeaderRow = document.getElementById('teacherRoutineTableHeaderRow');
    const teacherRoutineTableBody = document.getElementById('teacherRoutineTableBody');
    const teacherRoutineTemplateList = document.getElementById('teacherRoutineTemplateList');
    const teacherEmotionsGrid = document.getElementById('teacherEmotionsGrid');
    const teacherQuestionList = document.getElementById('teacherQuestionList');

    // Teacher Manage Routine Inputs
    const newRoutineTextInput = document.getElementById('newRoutineTextInput');
    const addRoutineTemplateBtn = document.getElementById('addRoutineTemplateBtn');
    
    // Teacher Answer Modal Elements
    const answerModal = document.getElementById('answerModal');
    const modalStudentQuestion = document.getElementById('modalStudentQuestion');
    const modalAnswerText = document.getElementById('modalAnswerText');
    const closeAnswerModalBtn = document.getElementById('closeAnswerModalBtn');
    const submitAnswerBtn = document.getElementById('submitAnswerBtn');

    let currentUser = null; // { id, name, role }
    let selectedEmotion = null;
    let currentSelectedQuestionId = null;
    let activeRoutineTemplates = []; // Loaded dynamically from Firebase
    let currentSlideIndex = 0;
    let teacherSelectedDate = new Date().toISOString().split('T')[0];
    let routineClickCount = 0; // Tracks checklist clicks to detect playful abuse

    // Binding teacher date filter
    const teacherDateFilter = document.getElementById('teacherDateFilter');
    if (teacherDateFilter) {
      teacherDateFilter.value = teacherSelectedDate;
      teacherDateFilter.addEventListener('change', (e) => {
        teacherSelectedDate = e.target.value;
        // Reload currently active teacher tab content
        const activeTab = document.querySelector('.teacher-tab.active');
        if (activeTab) {
          if (activeTab.id === 'tTabRoutines') loadTeacherRoutines();
          else if (activeTab.id === 'tTabEmotions') loadTeacherEmotions();
          else if (activeTab.id === 'tTabQuestions') loadTeacherQuestions();
        }
      });
    }

    // Toast utility (Pastel Success / Red Alert)
    const showToast = (message, isSuccess = true) => {
      toastMsg.textContent = message;
      toast.style.backgroundColor = isSuccess ? '#55efc4' : '#ff7675';
      toast.style.borderColor = isSuccess ? '#55efc4' : '#ff7675';
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    };

    // Default 6 Routines definition (Always ensured)
    const defaultRoutines = [
      { id: 'rt_1', text: '선생님과 인사하기(눈맞춤)', order: 1 },
      { id: 'rt_2', text: '시간표 보고 책 챙겨서 서랍정리하기', order: 2 },
      { id: 'rt_3', text: '과제 혹은 안내장 제출하기', order: 3 },
      { id: 'rt_4', text: '연필 깎아두기(3자루 이상)', order: 4 },
      { id: 'rt_5', text: '자기 자리 주변 확인하고 쓸기', order: 5 },
      { id: 'rt_6', text: '조용히 자리에서 책 읽기', order: 6 }
    ];

    // Ensure default templates exist and have correct clean text (Override/sync with DB)
    const ensureDefaultRoutines = async () => {
      try {
        const batch = db.batch();
        defaultRoutines.forEach(dr => {
          batch.set(db.collection('routineTemplates').doc(dr.id), dr);
        });
        await batch.commit();
        console.log("기본 6개 영구 필수 루틴 동기화 완료.");
      } catch (e) {
        console.error("기본 루틴 보존 세이프가드 작동 중 에러:", e);
      }
    };

    // 0. Seed Database (users & routineTemplates 초기 데이터 자동 삽입)
    const seedInitialData = async () => {
      try {
        // Users Seed
        // Users Seed (Forced Sync for the current class roster - 1 to 24 with encryption formula (학번뒤4자리*7)+(자릿수합*111))
        const initialUsers = [
          { id: 'teacher', name: '선생님', pin: 'teacher1234', role: 'teacher' },
          { id: '30101', name: '김O진', pin: '0929', role: 'student' },
          { id: '30102', name: '박O은', pin: '1047', role: 'student' },
          { id: '30103', name: '박O이', pin: '1165', role: 'student' },
          { id: '30104', name: '박O오', pin: '1283', role: 'student' },
          { id: '30105', name: '박O환', pin: '1401', role: 'student' },
          { id: '30106', name: '변O민', pin: '1519', role: 'student' },
          { id: '30107', name: '변O온', pin: '1637', role: 'student' },
          { id: '30108', name: '손O호', pin: '1755', role: 'student' },
          { id: '30109', name: '신O나', pin: '1873', role: 'student' },
          { id: '30110', name: '안O진', pin: '0992', role: 'student' },
          { id: '30111', name: '연O우', pin: '1110', role: 'student' },
          { id: '30112', name: '오O서', pin: '1228', role: 'student' },
          { id: '30113', name: '오O민', pin: '1346', role: 'student' },
          { id: '30114', name: '유O연', pin: '1464', role: 'student' },
          { id: '30115', name: '유예O', pin: '1582', role: 'student' },
          { id: '30116', name: '유하O', pin: '1700', role: 'student' },
          { id: '30117', name: '이O석', pin: '1818', role: 'student' },
          { id: '30118', name: '이O현', pin: '1936', role: 'student' },
          { id: '30119', name: '임O아', pin: '2054', role: 'student' },
          { id: '30120', name: '장O온', pin: '1173', role: 'student' },
          { id: '30121', name: '정O호', pin: '1291', role: 'student' },
          { id: '30122', name: '조O빈', pin: '1409', role: 'student' },
          { id: '30123', name: '창O준', pin: '1527', role: 'student' },
          { id: '30124', name: '최O용', pin: '1645', role: 'student' }
        ];

        const batch = db.batch();
        initialUsers.forEach(u => {
          batch.set(db.collection('users').doc(u.id), u);
        });
        await batch.commit();
        console.log("학급 학생 명부 DB 동기화 완료.");

        // Run default routines protection
        await ensureDefaultRoutines();

      } catch (error) {
        console.error("데이터 초기 시딩 에러:", error);
      }
    };
    seedInitialData();

    // 1. Session check & UI initialization
    const checkSession = () => {
      const savedUser = localStorage.getItem('currentUser');
      if (savedUser) {
        currentUser = JSON.parse(savedUser);
        applyLoginState();
      } else {
        loginOverlay.style.display = 'flex';
      }
    };

    const applyLoginState = async () => {
      loginOverlay.style.display = 'none';
      userStatusArea.style.display = 'flex';
      loggedInUserName.textContent = `${currentUser.name} (${currentUser.role === 'teacher' ? '교사' : '학생'})`;
      
      // Load current routine templates first
      await fetchRoutineTemplates();

      if (currentUser.role === 'teacher') {
        toolbarArea.style.display = 'none';
        mainNav.style.display = 'none';
        dashboardView.style.display = 'none';
        friendsView.style.display = 'none';
        teacherView.style.display = 'block';
        
        switchTeacherTab(tTabRoutines, tContentRoutines);
        if (teacherDateFilter) {
          teacherDateFilter.value = teacherSelectedDate;
        }
        loadTeacherRoutines();
      } else {
        toolbarArea.style.display = 'flex';
        mainNav.style.display = 'flex';
        studentNameInput.value = currentUser.name;
        
        tabDashboard.classList.add('active');
        tabFriends.classList.remove('active');
        dashboardView.style.display = 'block';
        friendsView.style.display = 'none';
        teacherView.style.display = 'none';
        
        // Reset slider slide & Click count
        goToSlide(0);
        routineClickCount = 0;
        
        loadStudentTodayData();
      }
    };

    // Fetch routine templates from Firestore (Ordered by 'order')
    const fetchRoutineTemplates = async () => {
      try {
        // Ensure defaults are present in templates database
        await ensureDefaultRoutines();
        
        const snapshot = await db.collection('routineTemplates').orderBy('order', 'asc').get();
        activeRoutineTemplates = [];
        snapshot.forEach(doc => {
          activeRoutineTemplates.push(doc.data());
        });
      } catch (error) {
        console.error("루틴 템플릿 로딩 에러:", error);
      }
    };

    // 2. Login Logic
    loginTabStudent.addEventListener('click', () => {
      loginTabStudent.classList.add('active');
      loginTabTeacher.classList.remove('active');
      studentLoginForm.style.display = 'flex';
      teacherLoginForm.style.display = 'none';
    });

    loginTabTeacher.addEventListener('click', () => {
      loginTabTeacher.classList.add('active');
      loginTabStudent.classList.remove('active');
      teacherLoginForm.style.display = 'flex';
      studentLoginForm.style.display = 'none';
    });

    studentLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const studentId = loginStudentId.value.trim();
      const pin = loginStudentPin.value.trim();

      try {
        const doc = await db.collection('users').doc(studentId).get();
        if (doc.exists && doc.data().pin === pin && doc.data().role === 'student') {
          currentUser = doc.data();
          localStorage.setItem('currentUser', JSON.stringify(currentUser));
          showToast(`어서와, ${currentUser.name} 친구!`);
          applyLoginState();
        } else {
          showToast('⚠️ 학번 또는 비밀번호가 올바르지 않습니다.', false);
        }
      } catch (error) {
        console.error("로그인 에러:", error);
        showToast('⚠️ 로그인 실패. 네트워크 상태를 확인하세요.', false);
      }
    });

    teacherLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pin = loginTeacherPin.value.trim();

      try {
        const doc = await db.collection('users').doc('teacher').get();
        if (doc.exists && doc.data().pin === pin) {
          currentUser = doc.data();
          localStorage.setItem('currentUser', JSON.stringify(currentUser));
          showToast(`선생님, 환영합니다!`);
          applyLoginState();
        } else {
          showToast('⚠️ 비밀번호가 올바르지 않습니다.', false);
        }
      } catch (error) {
        console.error("선생님 로그인 에러:", error);
        showToast('⚠️ 로그인 중 오류가 발생했습니다.', false);
      }
    });

    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('currentUser');
      currentUser = null;
      userStatusArea.style.display = 'none';
      dashboardView.style.display = 'none';
      friendsView.style.display = 'none';
      teacherView.style.display = 'none';
      
      loginStudentId.value = '';
      loginStudentPin.value = '';
      loginTeacherPin.value = '';
      diaryText.value = '';
      questionText.value = '';
      
      loginOverlay.style.display = 'flex';
      routineClickCount = 0;
      showToast('로그아웃 되었습니다.');
    });

    // 3. Student Tabs Nav
    tabDashboard.addEventListener('click', (e) => {
      e.preventDefault();
      tabDashboard.classList.add('active');
      tabFriends.classList.remove('active');
      dashboardView.style.display = 'block';
      friendsView.style.display = 'none';
      goToSlide(0); // Reset to routine checklist slide
    });

    tabFriends.addEventListener('click', (e) => {
      e.preventDefault();
      tabFriends.classList.add('active');
      tabDashboard.classList.remove('active');
      dashboardView.style.display = 'none';
      friendsView.style.display = 'block';
      loadFriendsStatus();
    });

    // 3.1 Carousel Slider Event Listeners
    const goToSlide = (index) => {
      currentSlideIndex = index;
      sliderTrack.style.transform = `translateX(-${index * 33.333}%)`;
      
      // Update dot active indicator
      indicatorDots.forEach((dot, idx) => {
        if (idx === index) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });
    };

    sliderPrevBtn.addEventListener('click', () => {
      let prevIndex = currentSlideIndex - 1;
      if (prevIndex < 0) prevIndex = 2; // Loop to last
      goToSlide(prevIndex);
    });

    sliderNextBtn.addEventListener('click', () => {
      let nextIndex = currentSlideIndex + 1;
      if (nextIndex > 2) nextIndex = 0; // Loop to first
      goToSlide(nextIndex);
    });

    indicatorDots.forEach(dot => {
      dot.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        goToSlide(index);
      });
    });

    // 4. Student Today Data Load & Dynamic Routine Renderer
    const loadStudentTodayData = async () => {
      if (!currentUser) return;
      const today = new Date().toISOString().split('T')[0];

      // Reset emotion buttons
      emotionButtons.forEach(b => b.classList.remove('selected'));
      selectedEmotion = null;

      try {
        // Load today's completed routines for this student
        const routinesSnapshot = await db.collection('routines')
          .where('studentId', '==', currentUser.id)
          .where('date', '==', today)
          .get();

        const completedMap = {};
        routinesSnapshot.forEach(doc => {
          const rData = doc.data();
          completedMap[rData.routineId] = rData.completed;
        });

        // Dynamic render routines in container
        studentRoutineListContainer.innerHTML = '';
        if (activeRoutineTemplates.length === 0) {
          studentRoutineListContainer.innerHTML = `<p style="text-align: center; color: var(--text-secondary); padding: 12px;">오늘 설정된 등교 루틴이 없습니다.</p>`;
          studentRoutineProgressText.textContent = `아침 등교 미션 완료!`;
          return;
        }

        let completedCount = 0;
        activeRoutineTemplates.forEach((template, index) => {
          const isChecked = completedMap[template.id] === true;
          if (isChecked) completedCount++;

          const itemHtml = `
            <div class="g-variant-item ${isChecked ? 'checked' : ''}" data-id="${template.id}">
              <span class="g-variant-text">${template.text}</span>
              <span class="g-variant-tag">루틴 0${index + 1}</span>
            </div>
          `;
          studentRoutineListContainer.insertAdjacentHTML('beforeend', itemHtml);
        });

        updateRoutineProgressUI(completedCount, activeRoutineTemplates.length);

        // Bind click events on dynamic elements
        document.querySelectorAll('#studentRoutineListContainer .g-variant-item').forEach(item => {
          item.addEventListener('click', () => toggleRoutineState(item));
        });

        // Load emotion diary
        const emotionDoc = await db.collection('emotions').doc(`${today}_${currentUser.id}`).get();
        if (emotionDoc.exists) {
          const emotionData = emotionDoc.data();
          const btn = document.querySelector(`.g-emotion-btn[data-emotion="${emotionData.emotion}"]`);
          if (btn) btn.classList.add('selected');
          selectedEmotion = emotionData.emotion;
          diaryText.value = emotionData.content || '';
        }

        // Load 1:1 question history
        loadStudentQuestionHistory();

      } catch (error) {
        console.error("학생 데이터 바인딩 중 오류:", error);
      }
    };

    const updateRoutineProgressUI = (completed, total) => {
      if (total === 0) return;
      const pct = Math.round((completed / total) * 100);
      if (pct === 100) {
        studentRoutineProgressText.textContent = `🎉 모두 완료! 루틴을 모두 점검했다면 책을 읽어요.`;
      } else {
        studentRoutineProgressText.textContent = `오늘 루틴 진척도: ${pct}% 완료 (${completed} / ${total})`;
      }
    };

    const toggleRoutineState = async (item) => {
      if (!currentUser) return;
      item.classList.toggle('checked');
      const isChecked = item.classList.contains('checked');
      const routineId = item.dataset.id;
      const routineText = item.querySelector('.g-variant-text').textContent;
      const today = new Date().toISOString().split('T')[0];
      const docId = `${today}_${currentUser.id}_${routineId}`;

      try {
        await db.collection('routines').doc(docId).set({
          studentId: currentUser.id,
          studentName: currentUser.name,
          routineId: routineId,
          routineText: routineText,
          completed: isChecked,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          date: today
        });

        // Update progress count
        const checkedItems = document.querySelectorAll('#studentRoutineListContainer .g-variant-item.checked').length;
        updateRoutineProgressUI(checkedItems, activeRoutineTemplates.length);

        // Increment click count to detect playful spamming
        routineClickCount++;

        if (isChecked) {
          if (routineClickCount > 17) {
            // After 5 warning prompts (12 + 5 = 17 clicks), cease providing any alerts/feedback entirely
            // Silent block
          } else if (routineClickCount > 12) {
            // Block animation and issue warning when clicks exceed threshold
            showToast('⚠️ 장난치지 않고 조용히 자리에 앉아 책을 읽어요!', false);
          } else {
            showToast(`루틴 완료! 잘하고 있어요.`);
            triggerConfettiEffect();
          }
        }
      } catch (error) {
        console.error("루틴 체크 에러:", error);
        showToast('⚠️ 저장을 실패했습니다. 네트워크 확인 필요', false);
      }
    };

    // Confetti Effect Generator (for Cute Elementary Celebrations)
    const triggerConfettiEffect = () => {
      const container = document.createElement('div');
      container.className = 'confetti-container';
      document.body.appendChild(container);

      const colors = ['#ff7675', '#ffeaa7', '#74b9ff', '#55efc4', '#a29bfe', '#ff9ff3', '#54a0ff'];
      const pieceCount = 60;

      for (let i = 0; i < pieceCount; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        
        // Randomize physics
        const left = Math.random() * 100; // viewport width %
        const delay = Math.random() * 0.8; // seconds delay
        const duration = 2 + Math.random() * 2; // seconds fall duration
        const sizeWidth = 8 + Math.random() * 8; // px
        const sizeHeight = 15 + Math.random() * 15; // px
        const color = colors[Math.floor(Math.random() * colors.length)];

        piece.style.left = `${left}vw`;
        piece.style.animationDelay = `${delay}s`;
        piece.style.animationDuration = `${duration}s`;
        piece.style.width = `${sizeWidth}px`;
        piece.style.height = `${sizeHeight}px`;
        piece.style.backgroundColor = color;
        piece.style.transform = `rotate(${Math.random() * 360}deg)`;

        container.appendChild(piece);
      }

      // Remove confetti container from DOM after falling is completed
      setTimeout(() => {
        container.remove();
      }, 4500);
    };

    const loadStudentQuestionHistory = async () => {
      if (!currentUser) return;
      try {
        const qSnapshot = await db.collection('questions')
          .where('studentId', '==', currentUser.id)
          .orderBy('timestamp', 'desc')
          .limit(10)
          .get();

        if (qSnapshot.empty) {
          studentQuestionHistory.innerHTML = `<p style="color: var(--text-secondary); font-size: 11px; text-align: center; margin-top: 30px;">질문 이력이 없습니다.</p>`;
          return;
        }

        studentQuestionHistory.innerHTML = '';
        qSnapshot.forEach(doc => {
          const q = doc.data();
          const qHtml = `
            <div class="student-q-item">
              <div class="student-q-content">❓ ${q.content}</div>
              ${q.reply ? `<div class="student-q-reply">👩‍🏫 선생님: ${q.reply}</div>` : `<div class="student-q-reply" style="color: #999; background: #fafafa;">아직 답변을 기다리고 있어요.</div>`}
            </div>
          `;
          studentQuestionHistory.insertAdjacentHTML('beforeend', qHtml);
        });
      } catch (error) {
        console.error("질문 히스토리 로딩 실패:", error);
      }
    };

    // Student Emotion Submit
    emotionButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        emotionButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedEmotion = btn.dataset.emotion;
      });
    });

    diarySubmit.addEventListener('click', async () => {
      if (!currentUser) return;
      if (!selectedEmotion) {
        showToast('⚠️ 오늘의 기분을 선택해 주세요!', false);
        return;
      }

      const content = diaryText.value.trim();
      const today = new Date().toISOString().split('T')[0];
      const docId = `${today}_${currentUser.id}`;

      try {
        diarySubmit.disabled = true;
        await db.collection('emotions').doc(docId).set({
          studentId: currentUser.id,
          studentName: currentUser.name,
          emotion: selectedEmotion,
          content: content,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          date: today
        });
        showToast('오늘의 마음 일기를 등록했습니다.');
      } catch (error) {
        console.error("일기 저장 실패:", error);
        showToast('⚠️ 저장 실패', false);
      } finally {
        diarySubmit.disabled = false;
      }
    });

    // Student Question Submit
    questionSubmit.addEventListener('click', async () => {
      if (!currentUser) return;
      const question = questionText.value.trim();
      if (!question) {
        showToast('⚠️ 질문 내용을 적어주세요!', false);
        return;
      }

      try {
        questionSubmit.disabled = true;
        await db.collection('questions').add({
          studentId: currentUser.id,
          studentName: currentUser.name,
          content: question,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          date: new Date().toISOString().split('T')[0],
          answered: false,
          reply: null
        });

        showToast('선생님께 질문을 전달했습니다!');
        questionText.value = '';
        loadStudentQuestionHistory();
      } catch (error) {
        console.error("질문 제출 실패:", error);
        showToast('⚠️ 전송 오류 발생', false);
      } finally {
        questionSubmit.disabled = false;
      }
    });

    // 5. Friends Status View (Student Page Tab 2) - Beautiful Material badges layout
    const loadFriendsStatus = async () => {
      friendsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: var(--text-secondary);">
          <span class="material-symbols-outlined" style="font-size: 48px; margin-bottom: 12px; color: var(--color-brand-blue); animation: wobble 2s infinite;">cloud_sync</span>
          <p style="font-size: 16px; font-weight: 700;">친구들의 오늘의 소식을 불러오고 있어요...</p>
        </div>
      `;

      const today = new Date().toISOString().split('T')[0];

      try {
        const [routinesSnapshot, emotionsSnapshot] = await Promise.all([
          db.collection('routines').where('date', '==', today).get(),
          db.collection('emotions').where('date', '==', today).get()
        ]);

        const students = {};
        const emotionEmojiMap = {
          happy: '<span class="material-symbols-outlined" style="color: #ff7675; font-size: 24px; vertical-align: middle;">sentiment_very_satisfied</span> 신나요',
          normal: '<span class="material-symbols-outlined" style="color: #ffeaa7; font-size: 24px; vertical-align: middle;">sentiment_neutral</span> 보통이에요',
          sad: '<span class="material-symbols-outlined" style="color: #74b9ff; font-size: 24px; vertical-align: middle;">sentiment_dissatisfied</span> 속상해요',
          angry: '<span class="material-symbols-outlined" style="color: #ff7675; font-size: 24px; vertical-align: middle;">mood_bad</span> 화나요',
          sleepy: '<span class="material-symbols-outlined" style="color: #a29bfe; font-size: 24px; vertical-align: middle;">bedtime</span> 졸려요'
        };

        emotionsSnapshot.forEach(doc => {
          const data = doc.data();
          if (!students[data.studentName]) {
            students[data.studentName] = {
              name: data.studentName,
              emotion: data.emotion,
              diary: data.content,
              routines: {}
            };
          }
        });

        routinesSnapshot.forEach(doc => {
          const data = doc.data();
          if (!students[data.studentName]) {
            students[data.studentName] = {
              name: data.studentName,
              emotion: null,
              diary: '',
              routines: {}
            };
          }
          students[data.studentName].routines[data.routineId] = data.completed;
        });

        const studentList = Object.values(students);

        if (studentList.length === 0) {
          friendsGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: var(--text-secondary);">
              <span class="material-symbols-outlined" style="font-size: 48px; margin-bottom: 12px; color: var(--color-brand-blue);">sentiment_dissatisfied</span>
              <p style="font-size: 14px; font-weight: 700;">아직 오늘 등교하여 기록한 친구가 없어요.</p>
            </div>
          `;
          return;
        }

        friendsGrid.innerHTML = '';
        studentList.forEach(student => {
          const emojiHtml = student.emotion ? emotionEmojiMap[student.emotion] : '<span class="material-symbols-outlined" style="color: #bdc1c6; font-size: 24px; vertical-align: middle;">help</span> 미기입';
          
          let routinesStatusIconsHtml = '';
          activeRoutineTemplates.forEach((t, index) => {
            const isCompleted = student.routines[t.id] === true;
            
            routinesStatusIconsHtml += `
              <span class="g-friend-routine-badge ${isCompleted ? 'active' : ''}" title="${t.text}">
                <span class="material-symbols-outlined g-friend-routine-badge-icon">${isCompleted ? 'check_circle' : 'circle'}</span>
                루틴 0${index + 1}
              </span>
            `;
          });

          const cardHtml = `
            <div class="g-card" style="min-height: 280px; box-shadow: 0 6px 0px var(--color-brand-blue);">
              <div class="g-card-header">
                <div class="g-card-meta">
                  <span class="g-card-title">${student.name} 친구</span>
                  <span class="g-card-author">오늘 아침 기록</span>
                </div>
              </div>
              <div class="g-friend-body">
                <div class="g-friend-emoji" style="display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 15px; font-weight: 800; color: var(--text-primary);">${emojiHtml}</div>
                <div class="g-friend-diary">${student.diary || '일기 작성 대기 중'}</div>
                <div class="g-friend-routines">
                  ${routinesStatusIconsHtml}
                </div>
              </div>
            </div>
          `;
          friendsGrid.insertAdjacentHTML('beforeend', cardHtml);
        });

      } catch (error) {
        console.error("친구들 기록 로드 에러:", error);
      }
    };

    // 6. Teacher Dashboard Tabs
    tTabRoutines.addEventListener('click', () => {
      switchTeacherTab(tTabRoutines, tContentRoutines);
      loadTeacherRoutines();
    });

    tTabManage.addEventListener('click', () => {
      switchTeacherTab(tTabManage, tContentManage);
      loadTeacherTemplatesManager();
    });

    tTabEmotions.addEventListener('click', () => {
      switchTeacherTab(tTabEmotions, tContentEmotions);
      loadTeacherEmotions();
    });

    tTabQuestions.addEventListener('click', () => {
      switchTeacherTab(tTabQuestions, tContentQuestions);
      loadTeacherQuestions();
    });

    const switchTeacherTab = (activeTab, activeContent) => {
      [tTabRoutines, tTabManage, tTabEmotions, tTabQuestions].forEach(tab => tab.classList.remove('active'));
      [tContentRoutines, tContentManage, tContentEmotions, tContentQuestions].forEach(content => content.style.display = 'none');
      activeTab.classList.add('active');
      activeContent.style.display = 'block';
    };

    // 7. Teacher Tab Actions & Renderers
    // A. Routines Status Table (Dynamically columns header & cells + Reset routines button)
    const loadTeacherRoutines = async () => {
      teacherRoutineTableHeaderRow.innerHTML = '';
      teacherRoutineTableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-secondary);">현황을 불러오고 있어요...</td></tr>`;

      try {
        await fetchRoutineTemplates();

        // 1. Build Header Row Dynamically
        let headerHtml = `<th>학번</th><th>이름</th>`;
        activeRoutineTemplates.forEach(t => {
          headerHtml += `<th style="text-align: center; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${t.text}">${t.text.substring(0, 7)}...</th>`;
        });
        headerHtml += `<th>완료율</th><th>제어</th>`;
        teacherRoutineTableHeaderRow.innerHTML = headerHtml;

        // 2. Fetch Users & Selected Date Routines records
        const [usersSnapshot, routinesSnapshot] = await Promise.all([
          db.collection('users').where('role', '==', 'student').get(),
          db.collection('routines').where('date', '==', teacherSelectedDate).get()
        ]);

        const routinesMap = {};
        routinesSnapshot.forEach(doc => {
          const r = doc.data();
          if (!routinesMap[r.studentId]) {
            routinesMap[r.studentId] = {};
          }
          routinesMap[r.studentId][r.routineId] = r.completed;
        });

        teacherRoutineTableBody.innerHTML = '';
        usersSnapshot.forEach(userDoc => {
          const student = userDoc.data();
          const studentCompletedMap = routinesMap[student.id] || {};

          let totalTemplates = activeRoutineTemplates.length;
          let completedCount = 0;
          
          let rowCellsHtml = `<td>${student.id}</td><td>${student.name}</td>`;
          
          activeRoutineTemplates.forEach(t => {
            const isDone = studentCompletedMap[t.id] === true;
            if (isDone) completedCount++;
            rowCellsHtml += `<td class="routine-status-check">${isDone ? '✅' : '❌'}</td>`;
          });

          const pct = totalTemplates > 0 ? Math.round((completedCount / totalTemplates) * 100) : 0;
          rowCellsHtml += `
            <td>
              <span class="status-badge-pct" style="background: ${pct === 100 ? '#55efc4' : '#ffeaa7'}; color: ${pct === 100 ? 'white' : '#d63031'};">
                ${pct}% (${completedCount}/${totalTemplates})
              </span>
            </td>
            <td>
              <button class="teacher-reset-btn" onclick="deleteStudentTodayRoutines('${student.id}', '${student.name}')">루틴 리셋</button>
            </td>
          `;

          teacherRoutineTableBody.insertAdjacentHTML('beforeend', `<tr>${rowCellsHtml}</tr>`);
        });

      } catch (error) {
        console.error("교사 루틴 대시보드 로딩 에러:", error);
      }
    };

    // Teacher Routine Reset Handler
    window.deleteStudentTodayRoutines = async (studentId, studentName) => {
      if (!confirm(`정말 ${studentName} 친구의 오늘 루틴 기록을 초기화하시겠습니까?\n작성된 체크 목록이 전부 지워집니다.`)) return;

      try {
        const snapshot = await db.collection('routines')
          .where('studentId', '==', studentId)
          .where('date', '==', teacherSelectedDate)
          .get();

        const batch = db.batch();
        snapshot.forEach(doc => {
          batch.delete(doc.ref);
        });

        await batch.commit();
        showToast(`${studentName} 친구의 루틴이 초기화되었습니다.`);
        loadTeacherRoutines();
      } catch (error) {
        console.error("루틴 초기화 에러:", error);
        showToast("루틴 리셋 실패", false);
      }
    };

    // B. Templates Manager (Add / Delete Routine Templates)
    const loadTeacherTemplatesManager = async () => {
      teacherRoutineTemplateList.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 12px;">불러오는 중...</div>`;
      
      try {
        await fetchRoutineTemplates();
        
        teacherRoutineTemplateList.innerHTML = '';
        if (activeRoutineTemplates.length === 0) {
          teacherRoutineTemplateList.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 12px;">현재 등교 루틴이 비어있습니다. 추가해 주세요.</div>`;
          return;
        }

        activeRoutineTemplates.forEach((template) => {
          // Check if this is a default routine to show indicator
          const isDefault = defaultRoutines.some(dr => dr.id === template.id);
          const deleteBtn = isDefault 
            ? `<span style="font-size: 11px; color: var(--text-secondary); font-weight: 700; padding: 6px;">[기본 루틴 영구 유지]</span>` 
            : `<button class="g-logout-btn" style="background: var(--color-brand-red);" onclick="deleteRoutineTemplate('${template.id}')">삭제</button>`;

          const item = `
            <div class="g-variant-item" style="cursor: default;">
              <span class="g-variant-text">${template.text}</span>
              ${deleteBtn}
            </div>
          `;
          teacherRoutineTemplateList.insertAdjacentHTML('beforeend', item);
        });

      } catch (error) {
        console.error("루틴 목록 로드 실패:", error);
      }
    };

    // Expose delete routine template globally
    window.deleteRoutineTemplate = async (templateId) => {
      // Safety check: Do not allow deletion of default routines
      if (defaultRoutines.some(dr => dr.id === templateId)) {
        showToast("⚠️ 기본 필수 등교 루틴은 지울 수 없습니다.", false);
        return;
      }

      if (!confirm("정말 이 등교 루틴을 삭제하시겠습니까?\n삭제 즉시 학생 화면에서도 이 항목이 사라집니다.")) return;

      try {
        await db.collection('routineTemplates').doc(templateId).delete();
        showToast("루틴 항목이 삭제되었습니다.");
        loadTeacherTemplatesManager();
      } catch (error) {
        console.error("템플릿 삭제 에러:", error);
        showToast("삭제 실패", false);
      }
    };

    // Add new routine template action
    addRoutineTemplateBtn.addEventListener('click', async () => {
      const newText = newRoutineTextInput.value.trim();
      if (!newText) {
        showToast("⚠️ 추가할 루틴의 내용을 작성해 주세요!", false);
        return;
      }

      try {
        addRoutineTemplateBtn.disabled = true;
        // Determine the next order number
        const nextOrder = activeRoutineTemplates.length > 0 ? (activeRoutineTemplates[activeRoutineTemplates.length - 1].order + 1) : 1;
        const newId = `rt_${Date.now()}`;

        await db.collection('routineTemplates').doc(newId).set({
          id: newId,
          text: newText,
          order: nextOrder
        });

        showToast("새로운 등교 루틴이 추가되었습니다!");
        newRoutineTextInput.value = '';
        loadTeacherTemplatesManager();
      } catch (error) {
        console.error("루틴 추가 에러:", error);
        showToast("추가에 실패했습니다.", false);
      } finally {
        addRoutineTemplateBtn.disabled = false;
      }
    });

    // C. Teacher Emotions View (with Delete Emotion Record button & Live Stacked Progress Chart)
    const loadTeacherEmotions = async () => {
      teacherEmotionsGrid.innerHTML = `<div style="grid-column:1/-1; text-align: center; color: var(--text-secondary);">로딩 중...</div>`;

      try {
        const [usersSnapshot, emotionsSnapshot] = await Promise.all([
          db.collection('users').where('role', '==', 'student').get(),
          db.collection('emotions').where('date', '==', teacherSelectedDate).get()
        ]);

        const emotionsMap = {};
        emotionsSnapshot.forEach(doc => {
          const data = doc.data();
          emotionsMap[data.studentId] = data;
        });

        const emotionEmojiMap = {
          happy: '<span class="material-symbols-outlined" style="color: #ff7675; font-size: 24px; vertical-align: middle;">sentiment_very_satisfied</span> 신나요',
          normal: '<span class="material-symbols-outlined" style="color: #ffeaa7; font-size: 24px; vertical-align: middle;">sentiment_neutral</span> 보통이에요',
          sad: '<span class="material-symbols-outlined" style="color: #74b9ff; font-size: 24px; vertical-align: middle;">sentiment_dissatisfied</span> 속상해요',
          angry: '<span class="material-symbols-outlined" style="color: #ff7675; font-size: 24px; vertical-align: middle;">mood_bad</span> 화나요',
          sleepy: '<span class="material-symbols-outlined" style="color: #a29bfe; font-size: 24px; vertical-align: middle;">bedtime</span> 졸려요'
        };

        // Compute statistics for emotions chart
        const stats = { happy: 0, normal: 0, sad: 0, angry: 0, sleepy: 0 };
        let totalRecordedEmotions = 0;

        emotionsSnapshot.forEach(doc => {
          const data = doc.data();
          if (stats[data.emotion] !== undefined) {
            stats[data.emotion]++;
            totalRecordedEmotions++;
          }
        });

        // Render Stats Bar Chart
        const teacherEmotionStats = document.getElementById('teacherEmotionStats');
        if (teacherEmotionStats) {
          if (totalRecordedEmotions === 0) {
            teacherEmotionStats.innerHTML = `
              <div class="g-stats-title">📊 기분 통계 요약 (${teacherSelectedDate})</div>
              <div style="text-align: center; color: var(--text-secondary); padding: 12px; font-size: 14px; font-weight: 700;">
                등록된 학생 감정이 없어 통계를 낼 수 없어요.
              </div>
            `;
          } else {
            const pPct = (key) => Math.round((stats[key] / totalRecordedEmotions) * 100);
            teacherEmotionStats.innerHTML = `
              <div class="g-stats-title">📊 기분 통계 요약 (기록 학생: ${totalRecordedEmotions}명)</div>
              <div class="g-stats-bar-container">
                ${stats.happy > 0 ? `<div class="g-stats-bar-segment" style="width: ${pPct('happy')}%; background-color: #ff7675;" title="신나요">${pPct('happy')}%</div>` : ''}
                ${stats.normal > 0 ? `<div class="g-stats-bar-segment" style="width: ${pPct('normal')}%; background-color: #ffeaa7; color: #6f5f00;" title="보통">${pPct('normal')}%</div>` : ''}
                ${stats.sad > 0 ? `<div class="g-stats-bar-segment" style="width: ${pPct('sad')}%; background-color: #74b9ff;" title="속상해요">${pPct('sad')}%</div>` : ''}
                ${stats.angry > 0 ? `<div class="g-stats-bar-segment" style="width: ${pPct('angry')}%; background-color: #ff7675;" title="화나요">${pPct('angry')}%</div>` : ''}
                ${stats.sleepy > 0 ? `<div class="g-stats-bar-segment" style="width: ${pPct('sleepy')}%; background-color: #a29bfe;" title="졸려요">${pPct('sleepy')}%</div>` : ''}
              </div>
              <div class="g-stats-legend">
                <div class="g-stats-legend-item"><div class="g-stats-legend-color" style="background-color: #ff7675;"></div>신나요 (${stats.happy}명)</div>
                <div class="g-stats-legend-item"><div class="g-stats-legend-color" style="background-color: #ffeaa7;"></div>보통이에요 (${stats.normal}명)</div>
                <div class="g-stats-legend-item"><div class="g-stats-legend-color" style="background-color: #74b9ff;"></div>속상해요 (${stats.sad}명)</div>
                <div class="g-stats-legend-item"><div class="g-stats-legend-color" style="background-color: #ff7675;"></div>화나요 (${stats.angry}명)</div>
                <div class="g-stats-legend-item"><div class="g-stats-legend-color" style="background-color: #a29bfe;"></div>졸려요 (${stats.sleepy}명)</div>
              </div>
            `;
          }
        }

        teacherEmotionsGrid.innerHTML = '';
        usersSnapshot.forEach(userDoc => {
          const student = userDoc.data();
          const emotionObj = emotionsMap[student.id];

          const emojiText = emotionObj ? emotionEmojiMap[emotionObj.emotion] : '<span class="material-symbols-outlined" style="color: #bdc1c6; font-size: 24px; vertical-align: middle;">help</span> 기분 미입력';
          const diary = emotionObj ? emotionObj.content : '감정 일기를 아직 쓰지 않았어요.';

          const card = `
            <div class="g-card" style="min-height: 250px; border-left: 6px solid var(--color-brand); border-radius: 12px; box-shadow: 0 4px 0 var(--border-color);">
              <div class="g-card-header">
                <div class="g-card-meta">
                  <span class="g-card-title">${student.name} 친구</span>
                  <span class="g-card-author">${student.id}</span>
                </div>
                ${emotionObj ? `<button class="teacher-reset-btn" onclick="deleteStudentTodayEmotion('${student.id}', '${student.name}')">삭제</button>` : ''}
              </div>
              <div class="g-friend-body" style="padding: 6px 0;">
                <div style="font-size: 14px; font-weight: 800; color: var(--color-brand); margin-bottom: 6px;">${emojiText}</div>
                <div class="g-friend-diary" style="width:100%; min-height:60px; border-radius: 8px;">${diary}</div>
              </div>
            </div>
          `;
          teacherEmotionsGrid.insertAdjacentHTML('beforeend', card);
        });

      } catch (error) {
        console.error("감정 목록 로드 실패:", error);
      }
    };

    // Teacher Emotion Reset Handler
    window.deleteStudentTodayEmotion = async (studentId, studentName) => {
      if (!confirm(`정말 ${studentName} 친구의 오늘 감정 일기 기록을 삭제하시겠습니까?\n작성한 일기 내용과 기분이 리셋됩니다.`)) return;

      const today = new Date().toISOString().split('T')[0];
      const docId = `${today}_${studentId}`;

      try {
        await db.collection('emotions').doc(docId).delete();
        showToast(`${studentName} 친구의 감정 일기가 삭제되었습니다.`);
        loadTeacherEmotions();
      } catch (error) {
        console.error("일기 삭제 실패:", error);
        showToast("일기 삭제 실패", false);
      }
    };

    // D. Teacher 1:1 Secret Question View (with Delete Question record button)
    const loadTeacherQuestions = async () => {
      teacherQuestionList.innerHTML = `<div style="text-align: center; color: var(--text-secondary);">로딩 중...</div>`;

      try {
        const questionsSnapshot = await db.collection('questions')
          .where('date', '==', teacherSelectedDate)
          .get();

        if (questionsSnapshot.empty) {
          teacherQuestionList.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 40px;">오늘 등록된 비밀 질문이 없습니다.</div>`;
          return;
        }

        const qDocs = questionsSnapshot.docs.sort((a, b) => {
          const tA = a.data().timestamp ? a.data().timestamp.toMillis() : 0;
          const tB = b.data().timestamp ? b.data().timestamp.toMillis() : 0;
          return tB - tA;
        });

        teacherQuestionList.innerHTML = '';
        qDocs.forEach(doc => {
          const q = doc.data();
          const qId = doc.id;
          const timeString = q.timestamp ? new Date(q.timestamp.toMillis()).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '';
          
          const card = `
            <div class="teacher-question-card" style="border-radius: 12px; border: 2px dashed var(--border-color); box-shadow: 0 4px 0 var(--border-color);">
              <div class="teacher-question-meta">
                <span class="teacher-question-student">${q.studentName} (${q.studentId})</span>
                <span class="teacher-question-time">${timeString}</span>
              </div>
              <div class="teacher-question-content" style="border-radius: 8px; border: 1px solid var(--border-color);">${q.content}</div>
              ${q.reply ? `<div class="teacher-question-reply" style="border-radius: 8px;">👩‍🏫 나의 답변: ${q.reply}</div>` : ''}
              
              <div style="display: flex; gap: 8px; margin-top: 10px;">
                ${q.reply ? `
                  <button class="g-logout-btn" style="background: var(--color-brand-blue); border-radius: 20px; box-shadow: 0 2px 0 #4b8df8; margin:0;" onclick="openAnswerModal('${qId}', '${q.studentName}', '${q.content.replace(/'/g, "\\'")}')">답변 수정</button>
                ` : `
                  <button class="g-card-submit-btn" style="background: var(--color-brand-purple); border-radius: 20px; box-shadow: 0 4px 0 #706fd3; margin:0;" onclick="openAnswerModal('${qId}', '${q.studentName}', '${q.content.replace(/'/g, "\\'")}')">답변하기</button>
                `}
                <button class="teacher-reset-btn" onclick="deleteStudentQuestion('${qId}', '${q.studentName}')">질문 삭제</button>
              </div>
            </div>
          `;
          teacherQuestionList.insertAdjacentHTML('beforeend', card);
        });

      } catch (error) {
        console.error("질문 목록 로딩 실패:", error);
      }
    };

    // Teacher Question Reset Handler
    window.deleteStudentQuestion = async (qId, studentName) => {
      if (!confirm(`정말 ${studentName} 친구의 이 비밀 질문을 완전히 삭제하시겠습니까?\n삭제한 내역은 복구되지 않습니다.`)) return;

      try {
        await db.collection('questions').doc(qId).delete();
        showToast("학생의 비밀 질문글을 삭제했습니다.");
        loadTeacherQuestions();
      } catch (error) {
        console.error("질문 삭제 실패:", error);
        showToast("질문 삭제 실패", false);
      }
    };

    // Global Modal handlers
    window.openAnswerModal = (qId, studentName, content) => {
      currentSelectedQuestionId = qId;
      modalStudentQuestion.textContent = `${studentName} 친구의 질문: "${content}"`;
      modalAnswerText.value = '';
      answerModal.style.display = 'flex';
    };

    closeAnswerModalBtn.addEventListener('click', () => {
      answerModal.style.display = 'none';
      currentSelectedQuestionId = null;
    });

    submitAnswerBtn.addEventListener('click', async () => {
      const replyText = modalAnswerText.value.trim();
      if (!replyText) {
        showToast('⚠️ 답변 내용을 입력해 주세요!', false);
        return;
      }

      try {
        submitAnswerBtn.disabled = true;
        await db.collection('questions').doc(currentSelectedQuestionId).update({
          reply: replyText,
          answered: true
        });

        showToast('🎉 답변을 성공적으로 보냈습니다!');
        answerModal.style.display = 'none';
        loadTeacherQuestions();
      } catch (error) {
        console.error("답변 작성 에러:", error);
        showToast('⚠️ 답변 전송 실패', false);
      } finally {
        submitAnswerBtn.disabled = false;
      }
    });

    // Start App Session check
    checkSession();

  } else {
    console.error("Firebase SDK is not loaded.");
  }
});
